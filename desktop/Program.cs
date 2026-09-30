using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Reflection;
using System.Runtime.InteropServices;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace MpNexus.Launcher;

internal static class Program
{
    private const int FirstPort = 5173;
    private const int LastPort = 5200;
    private const string ResourcePrefix = "MpNexusDemo/";

    [STAThread]
    private static async Task<int> Main()
    {
        try
        {
            var containerMode = Environment.GetEnvironmentVariable("MP_NEXUS_CONTAINER") == "1";
            var port = containerMode && int.TryParse(Environment.GetEnvironmentVariable("MP_NEXUS_PORT"), out var configuredPort)
                ? configuredPort
                : containerMode ? 8080 : FindPort();
            var token = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(24));
            var lanIp = containerMode ? null : GetLanAddress();
            var publicUrl = Environment.GetEnvironmentVariable("MP_NEXUS_PUBLIC_URL")?.TrimEnd('/');

            var builder = WebApplication.CreateBuilder();
            builder.WebHost.ConfigureKestrel(server =>
            {
                if (containerMode) server.ListenAnyIP(port);
                else
                {
                    server.ListenLocalhost(port);
                    if (lanIp is not null) server.Listen(lanIp, port);
                }
            });
            if (containerMode)
                builder.Services.Configure<ForwardedHeadersOptions>(options =>
                {
                    options.ForwardedHeaders = ForwardedHeaders.XForwardedHost | ForwardedHeaders.XForwardedProto;
                    options.KnownIPNetworks.Clear();
                    options.KnownProxies.Clear();
                });
            var app = builder.Build();
            if (containerMode) app.UseForwardedHeaders();
            var resources = LoadDemoResources();
            var mime = new FileExtensionContentTypeProvider();
            var localUrl = $"http://127.0.0.1:{port}/__mpnexus/";
            var lifetime = app.Lifetime;

            app.MapGet("/__mpnexus/", async context => await WriteResource(context, "desktop/launcher.html", resources, mime));
            app.MapGet("/__mpnexus/config.json", (HttpContext context) =>
            {
                var origin = publicUrl ?? $"{context.Request.Scheme}://{context.Request.Host}";
                var mobileUrl = $"{origin}/?spatial&floors&laundry";
                var launcherUrl = containerMode ? $"{origin}/__mpnexus/" : localUrl;
                return Results.Json(new { localUrl = launcherUrl, mobileUrl, stopToken = containerMode ? null : token, mobileAvailable = containerMode || lanIp is not null, canStop = !containerMode });
            });
            app.MapPost("/__mpnexus/stop", async context =>
            {
                var supplied = context.Request.Headers["X-MP-Nexus-Token"].ToString();
                if (!System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(
                    System.Text.Encoding.UTF8.GetBytes(supplied), System.Text.Encoding.UTF8.GetBytes(token)))
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    return;
                }
                context.Response.StatusCode = StatusCodes.Status202Accepted;
                _ = Task.Run(async () => { await Task.Delay(350); lifetime.StopApplication(); });
                await context.Response.WriteAsync("MP Nexus va s’arrêter.");
            });
            app.MapFallback("/{**path}", async context =>
            {
                var path = context.Request.Path.Value?.TrimStart('/') ?? "";
                if (path.StartsWith("__mpnexus", StringComparison.Ordinal))
                {
                    context.Response.StatusCode = StatusCodes.Status404NotFound;
                    return;
                }
                if (!resources.ContainsKey(path)) path = "index.html";
                await WriteResource(context, path, resources, mime);
            });

            await app.StartAsync();
            OpenBrowser(localUrl);
            await app.WaitForShutdownAsync();
            await app.DisposeAsync();
            return 0;
        }
        catch (Exception ex)
        {
            ShowStartupError(ex);
            return 1;
        }
    }

    private static Dictionary<string, byte[]> LoadDemoResources()
    {
        var resources = new Dictionary<string, byte[]>(StringComparer.OrdinalIgnoreCase);
        var assembly = Assembly.GetExecutingAssembly();
        foreach (var rawName in assembly.GetManifestResourceNames())
        {
            var name = rawName.Replace('\\', '/');
            if (!name.StartsWith(ResourcePrefix, StringComparison.Ordinal)) continue;
            using var stream = assembly.GetManifestResourceStream(rawName);
            if (stream is null) continue;
            using var output = new MemoryStream();
            stream.CopyTo(output);
            resources[name[ResourcePrefix.Length..]] = output.ToArray();
        }
        if (!resources.ContainsKey("index.html") || !resources.ContainsKey("desktop/launcher.html"))
            throw new InvalidOperationException("Le contenu de MP Nexus est incomplet. Téléchargez de nouveau l’application.");
        return resources;
    }

    private static async Task WriteResource(HttpContext context, string path, IReadOnlyDictionary<string, byte[]> resources, FileExtensionContentTypeProvider mime)
    {
        if (!resources.TryGetValue(path, out var content))
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }
        if (!mime.TryGetContentType(path, out var contentType)) contentType = "application/octet-stream";
        context.Response.ContentType = contentType;
        context.Response.Headers.CacheControl = path.EndsWith(".html", StringComparison.OrdinalIgnoreCase) ? "no-store" : "public,max-age=3600";
        context.Response.ContentLength = content.LongLength;
        await context.Response.Body.WriteAsync(content);
    }

    private static int FindPort()
    {
        for (var port = FirstPort; port <= LastPort; port++)
        {
            try
            {
                using var listener = new TcpListener(IPAddress.Any, port);
                listener.Start();
                return port;
            }
            catch (SocketException) { }
        }
        throw new InvalidOperationException("Aucun port libre entre 5173 et 5200. Fermez un autre serveur MP Nexus, puis réessayez.");
    }

    private static IPAddress? GetLanAddress()
    {
        var interfaces = NetworkInterface.GetAllNetworkInterfaces()
            .Where(network => network.OperationalStatus == OperationalStatus.Up && network.NetworkInterfaceType is NetworkInterfaceType.Ethernet or NetworkInterfaceType.Wireless80211)
            .OrderBy(network => network.NetworkInterfaceType == NetworkInterfaceType.Wireless80211 ? 0 : 1);
        foreach (var network in interfaces)
        {
            var description = (network.Name + " " + network.Description).ToLowerInvariant();
            if (new[] { "virtual", "vpn", "hyper-v", "vmware", "virtualbox", "docker", "loopback" }.Any(description.Contains)) continue;
            var address = network.GetIPProperties().UnicastAddresses
                .Select(unicast => unicast.Address)
                .FirstOrDefault(IsPrivateIPv4);
            if (address is not null) return address;
        }
        return null;
    }

    private static bool IsPrivateIPv4(IPAddress address)
    {
        if (address.AddressFamily != AddressFamily.InterNetwork || IPAddress.IsLoopback(address)) return false;
        var bytes = address.GetAddressBytes();
        return bytes[0] == 10 || bytes[0] == 192 && bytes[1] == 168 || bytes[0] == 172 && bytes[1] is >= 16 and <= 31;
    }

    private static void OpenBrowser(string url)
    {
        if (Environment.GetEnvironmentVariable("MP_NEXUS_LAUNCHER_NO_BROWSER") == "1") return;
        try
        {
            if (OperatingSystem.IsMacOS())
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("open", url) { UseShellExecute = false });
            else
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(url) { UseShellExecute = true });
        }
        catch (Exception ex)
        {
            ShowStartupError(new InvalidOperationException("MP Nexus est prêt. Ouvrez cette adresse dans votre navigateur : " + url, ex));
        }
    }

    private static void ShowStartupError(Exception ex)
    {
        var message = "MP Nexus n’a pas pu démarrer.\n\n" + ex.GetBaseException().Message;
        if (OperatingSystem.IsWindows())
            MessageBox(IntPtr.Zero, message, "MP Nexus", 0x10);
        else
            Console.Error.WriteLine(message);
    }

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern int MessageBox(IntPtr window, string text, string caption, uint type);
}
