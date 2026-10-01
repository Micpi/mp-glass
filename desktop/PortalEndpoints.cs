using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection;

namespace MpNexus.Launcher;

internal static class PortalEndpoints
{
    private const string Scheme = "MPNexusDemo";
    private const string StampClaim = "mpnexus_stamp";
    private const string SessionClaim = "mpnexus_session";
    private const string MustChangeClaim = "mpnexus_must_change";

    public static void AddServices(WebApplicationBuilder builder, PortalStore store, string dataDirectory)
    {
        Directory.CreateDirectory(Path.Combine(dataDirectory, "keys"));
        builder.Services.AddSingleton(store);
        builder.Services.AddDataProtection()
            .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(dataDirectory, "keys")))
            .SetApplicationName("MPNexus.SynologyDemo");
        builder.Services.AddAuthentication(Scheme).AddCookie(Scheme, options =>
        {
            options.Cookie.Name = "MPNexus.Demo.Session";
            options.Cookie.HttpOnly = true;
            options.Cookie.SameSite = SameSiteMode.Strict;
            options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
            options.ExpireTimeSpan = TimeSpan.FromHours(12);
            options.SlidingExpiration = true;
            options.Events.OnValidatePrincipal = async context =>
            {
                var principal = context.Principal;
                var userId = principal?.FindFirstValue(ClaimTypes.NameIdentifier);
                var stamp = principal?.FindFirstValue(StampClaim);
                var role = principal?.FindFirstValue(ClaimTypes.Role);
                var accounts = context.HttpContext.RequestServices.GetRequiredService<PortalStore>();
                if (userId is null || stamp is null || role is null || !await accounts.ValidateIdentityAsync(userId, stamp, role))
                {
                    context.RejectPrincipal();
                    await context.HttpContext.SignOutAsync(Scheme);
                }
            };
        });
        builder.Services.AddAuthorization(options => options.AddPolicy("MPNexusAdmin", policy => policy.RequireRole("admin")));
        builder.Services.AddRateLimiter(options => options.AddPolicy("MPNexusLogin", context =>
            RateLimitPartition.GetFixedWindowLimiter(
                context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 8,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                    AutoReplenishment = true
                })));
        builder.Services.AddAntiforgery(options =>
        {
            options.HeaderName = "X-MP-Nexus-CSRF";
            options.Cookie.Name = "MPNexus.Demo.CSRF";
            options.Cookie.HttpOnly = true;
            options.Cookie.SameSite = SameSiteMode.Strict;
            options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        });
    }

    public static void UseAccessGate(WebApplication app, PortalStore store)
    {
        app.UseAuthentication();
        app.Use(async (context, next) =>
        {
            var path = context.Request.Path;
            var assetName = path.Value ?? "";
            var portalAsset = path.StartsWithSegments("/assets")
                && (assetName.Contains("/access-", StringComparison.Ordinal)
                    || assetName.Contains("/browser-", StringComparison.Ordinal)
                    || assetName.Contains("/_commonjsHelpers-", StringComparison.Ordinal));
            var publicEndpoint = path.Equals("/__mpnexus/login", StringComparison.OrdinalIgnoreCase)
                || path.Equals("/__mpnexus/api/login", StringComparison.OrdinalIgnoreCase)
                || path.Equals("/__mpnexus/api/csrf", StringComparison.OrdinalIgnoreCase)
                || portalAsset
                || path.Equals("/favicon.ico", StringComparison.OrdinalIgnoreCase);

            if (context.User.Identity?.IsAuthenticated != true)
            {
                if (publicEndpoint) { await next(); return; }
                if (path.StartsWithSegments("/__mpnexus/api"))
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return;
                }
                var requested = context.Request.Path + context.Request.QueryString;
                context.Response.Redirect("/__mpnexus/login?returnUrl=" + Uri.EscapeDataString(requested));
                return;
            }

            var sessionId = context.User.FindFirstValue(SessionClaim);
            if (sessionId is not null)
                await store.TouchSessionAsync(sessionId, context.Request.Method == "GET" && path == "/");

            if (context.User.HasClaim(MustChangeClaim, "true")
                && !path.StartsWithSegments("/__mpnexus")
                && !path.StartsWithSegments("/assets"))
            {
                context.Response.Redirect("/__mpnexus/?changePassword=1");
                return;
            }

            await next();
        });
        app.UseAuthorization();
        app.UseRateLimiter();
    }

    public static void Map(WebApplication app, IReadOnlyDictionary<string, byte[]> resources, FileExtensionContentTypeProvider mime, PortalStore store, string version)
    {
        app.MapGet("/__mpnexus/login", async context => await Program.WriteResource(context, "desktop/access.html", resources, mime));
        app.MapGet("/__mpnexus/", async context => await Program.WriteResource(context, "desktop/access.html", resources, mime)).RequireAuthorization();
        app.MapGet("/__mpnexus/admin", async context => await Program.WriteResource(context, "desktop/access.html", resources, mime)).RequireAuthorization("MPNexusAdmin");
        app.MapGet("/__mpnexus/admin/users", async context => await Program.WriteResource(context, "desktop/access.html", resources, mime)).RequireAuthorization("MPNexusAdmin");

        app.MapGet("/__mpnexus/api/csrf", (HttpContext context, IAntiforgery antiforgery) =>
        {
            var tokens = antiforgery.GetAndStoreTokens(context);
            return Results.Json(new { token = tokens.RequestToken });
        });

        app.MapPost("/__mpnexus/api/login", async (HttpContext context, LoginRequest request, IAntiforgery antiforgery) =>
        {
            if (!await HasValidAntiforgeryToken(context, antiforgery)) return Results.BadRequest(new { error = "La page a expiré. Rechargez-la puis réessayez." });
            var user = await store.FindUserAsync(request.Username ?? "");
            if (user is null || !PortalStore.VerifyPassword(request.Password ?? "", user.PasswordHash))
                return Results.Json(new { error = "Nom d’utilisateur ou mot de passe incorrect." }, statusCode: StatusCodes.Status401Unauthorized);
            var session = await store.StartSessionAsync(user.Id);
            if (session is null) return Results.Json(new { error = "Ce compte n’est plus actif." }, statusCode: StatusCodes.Status401Unauthorized);
            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id), new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.Role, user.Role), new Claim(StampClaim, user.SecurityStamp),
                new Claim(SessionClaim, session.Id), new Claim(MustChangeClaim, user.MustChangePassword ? "true" : "false")
            };
            var identity = new ClaimsIdentity(claims, Scheme);
            await context.SignInAsync(Scheme, new ClaimsPrincipal(identity), new AuthenticationProperties { IsPersistent = false, AllowRefresh = true });
            return Results.Json(new { returnUrl = SafeReturnUrl(request.ReturnUrl), user = new { user.Username, role = user.Role, mustChangePassword = user.MustChangePassword } });
        }).RequireRateLimiting("MPNexusLogin");

        app.MapGet("/__mpnexus/api/me", async (HttpContext context) =>
        {
            var id = context.User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var user = await store.GetCurrentUserAsync(id);
            return user is null ? Results.Unauthorized() : Results.Json(new { user, version });
        }).RequireAuthorization();

        app.MapPost("/__mpnexus/api/password", async (HttpContext context, PasswordRequest request, IAntiforgery antiforgery) =>
        {
            if (!await HasValidAntiforgeryToken(context, antiforgery)) return Results.BadRequest(new { error = "La page a expiré. Rechargez-la puis réessayez." });
            var id = context.User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var current = request.CurrentPassword ?? "";
            if (context.User.HasClaim(MustChangeClaim, "true")) current = request.TemporaryPassword ?? "";
            var result = await store.ChangePasswordAsync(id, current, request.NewPassword ?? "");
            if (!result.Success) return Results.BadRequest(new { error = result.Error });
            var user = await store.GetCurrentUserAsync(id);
            if (user is null) return Results.Unauthorized();
            var sessionId = context.User.FindFirstValue(SessionClaim)!;
            var stamp = (await store.FindUserAsync(user.Username))!.SecurityStamp;
            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id), new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.Role, user.Role), new Claim(StampClaim, stamp),
                new Claim(SessionClaim, sessionId), new Claim(MustChangeClaim, "false")
            };
            await context.SignInAsync(Scheme, new ClaimsPrincipal(new ClaimsIdentity(claims, Scheme)));
            return Results.Json(new { ok = true });
        }).RequireAuthorization();

        app.MapPost("/__mpnexus/api/logout", async (HttpContext context, IAntiforgery antiforgery) =>
        {
            if (!await HasValidAntiforgeryToken(context, antiforgery)) return Results.BadRequest(new { error = "La page a expiré. Rechargez-la puis réessayez." });
            var sessionId = context.User.FindFirstValue(SessionClaim);
            if (sessionId is not null) await store.EndSessionAsync(sessionId);
            await context.SignOutAsync(Scheme);
            return Results.Json(new { ok = true });
        }).RequireAuthorization();

        app.MapPost("/__mpnexus/api/session/touch", async (HttpContext context, IAntiforgery antiforgery) =>
        {
            if (!await HasValidAntiforgeryToken(context, antiforgery)) return Results.BadRequest();
            var sessionId = context.User.FindFirstValue(SessionClaim);
            if (sessionId is not null) await store.TouchSessionAsync(sessionId, false);
            return Results.NoContent();
        }).RequireAuthorization();

        app.MapGet("/__mpnexus/api/admin/analytics", async () => Results.Json(await store.GetAnalyticsAsync())).RequireAuthorization("MPNexusAdmin");
        app.MapGet("/__mpnexus/api/admin/users", async () => Results.Json(await store.ListUsersAsync())).RequireAuthorization("MPNexusAdmin");
        app.MapPost("/__mpnexus/api/admin/users", async (HttpContext context, ManageUserRequest request, IAntiforgery antiforgery) =>
        {
            if (!await HasValidAntiforgeryToken(context, antiforgery)) return Results.BadRequest(new { error = "La page a expiré. Rechargez-la puis réessayez." });
            var result = await store.AddUserAsync(request.Username ?? "", request.Password ?? "", request.Role ?? "user");
            return result.Success ? Results.Ok(new { ok = true }) : Results.BadRequest(new { error = result.Error });
        }).RequireAuthorization("MPNexusAdmin");
        app.MapPost("/__mpnexus/api/admin/users/{id}/password", async (string id, HttpContext context, AdminPasswordRequest request, IAntiforgery antiforgery) =>
        {
            if (!await HasValidAntiforgeryToken(context, antiforgery)) return Results.BadRequest(new { error = "La page a expiré. Rechargez-la puis réessayez." });
            var result = await store.ResetPasswordAsync(id, request.Password ?? "");
            return result.Success ? Results.Ok(new { ok = true }) : Results.BadRequest(new { error = result.Error });
        }).RequireAuthorization("MPNexusAdmin");
        app.MapPost("/__mpnexus/api/admin/users/{id}/role", async (string id, HttpContext context, RoleRequest request, IAntiforgery antiforgery) =>
        {
            if (!await HasValidAntiforgeryToken(context, antiforgery)) return Results.BadRequest(new { error = "La page a expiré. Rechargez-la puis réessayez." });
            var result = await store.SetRoleAsync(id, request.Role ?? "user", context.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            return result.Success ? Results.Ok(new { ok = true }) : Results.BadRequest(new { error = result.Error });
        }).RequireAuthorization("MPNexusAdmin");
        app.MapDelete("/__mpnexus/api/admin/users/{id}", async (string id, HttpContext context, IAntiforgery antiforgery) =>
        {
            if (!await HasValidAntiforgeryToken(context, antiforgery)) return Results.BadRequest(new { error = "La page a expiré. Rechargez-la puis réessayez." });
            var result = await store.DeleteUserAsync(id, context.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            return result.Success ? Results.Ok(new { ok = true }) : Results.BadRequest(new { error = result.Error });
        }).RequireAuthorization("MPNexusAdmin");
    }

    private static async Task<bool> HasValidAntiforgeryToken(HttpContext context, IAntiforgery antiforgery)
    {
        try { await antiforgery.ValidateRequestAsync(context); return true; }
        catch (AntiforgeryValidationException) { return false; }
    }

    private static string SafeReturnUrl(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || !value.StartsWith('/') || value.StartsWith("//") || value.StartsWith("/\\"))
            return "/__mpnexus/";

        // A visitor who opens the demo URL directly must choose an environment after signing in.
        // Preserve a direct admin deep link, but send demo routes and other paths to the portal first.
        var path = value.Split('?', '#')[0];
        return path.Equals("/__mpnexus/admin", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("/__mpnexus/admin/", StringComparison.OrdinalIgnoreCase)
            ? value
            : "/__mpnexus/";
    }

    private sealed record LoginRequest(string? Username, string? Password, string? ReturnUrl);
    private sealed record PasswordRequest(string? CurrentPassword, string? TemporaryPassword, string? NewPassword);
    private sealed record ManageUserRequest(string? Username, string? Password, string? Role);
    private sealed record AdminPasswordRequest(string? Password);
    private sealed record RoleRequest(string? Role);
}
