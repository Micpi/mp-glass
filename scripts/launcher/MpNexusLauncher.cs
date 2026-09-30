using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace MpNexusLauncher
{
    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new LauncherForm());
        }
    }

    internal sealed class LauncherForm : Form
    {
        private readonly string root = AppDomain.CurrentDomain.BaseDirectory;
        private readonly int port;
        private readonly string url;
        private readonly Label status = new Label();
        private readonly ProgressBar progress = new ProgressBar();
        private readonly Button retry = new Button();
        private readonly Button open = new Button();
        private readonly Button stop = new Button();
        private readonly NotifyIcon tray = new NotifyIcon();
        private readonly StringBuilder log = new StringBuilder();
        private readonly object logLock = new object();
        private readonly object childLock = new object();
        private Process child;
        private bool ready;
        private volatile bool closing;

        internal LauncherForm()
        {
            int requested;
            port = int.TryParse(Environment.GetEnvironmentVariable("MP_NEXUS_LAUNCHER_PORT"), out requested) && requested > 0 && requested < 65536 ? requested : 5173;
            url = "http://localhost:" + port + "/?spatial&floors&laundry";
            Text = "MP Nexus — serveur local";
            Icon = SystemIcons.Application;
            ClientSize = new Size(410, 174);
            MinimumSize = new Size(426, 213);
            MaximizeBox = false;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            StartPosition = FormStartPosition.CenterScreen;

            var title = new Label { Text = "MP Nexus", Font = new Font("Segoe UI", 16, FontStyle.Bold), Location = new Point(18, 15), Size = new Size(370, 33) };
            status.Text = "Préparation du serveur local…";
            status.Location = new Point(20, 53);
            status.Size = new Size(370, 41);
            progress.Location = new Point(20, 101);
            progress.Size = new Size(370, 8);
            progress.Style = ProgressBarStyle.Marquee;
            retry.Text = "Réessayer";
            retry.Location = new Point(20, 126);
            retry.Size = new Size(95, 29);
            retry.Enabled = false;
            retry.Click += delegate { BeginStartup(); };
            open.Text = "Ouvrir le plan";
            open.Location = new Point(123, 126);
            open.Size = new Size(135, 29);
            open.Enabled = false;
            open.Click += delegate { OpenBrowser(); };
            stop.Text = "Arrêter";
            stop.Location = new Point(266, 126);
            stop.Size = new Size(124, 29);
            stop.Click += delegate { Close(); };
            Controls.AddRange(new Control[] { title, status, progress, retry, open, stop });

            var menu = new ContextMenuStrip();
            menu.Items.Add("Ouvrir le plan", null, delegate { OpenBrowser(); });
            menu.Items.Add("Afficher le lanceur", null, delegate { Show(); WindowState = FormWindowState.Normal; Activate(); });
            menu.Items.Add("Arrêter le serveur", null, delegate { Close(); });
            tray.Icon = SystemIcons.Application;
            tray.Text = "MP Nexus — serveur local";
            tray.ContextMenuStrip = menu;
            tray.Visible = true;
            tray.DoubleClick += delegate { OpenBrowser(); };
            Shown += delegate { BeginStartup(); };
            FormClosing += delegate { closing = true; tray.Visible = false; StopChild(); };
        }

        private async void BeginStartup()
        {
            retry.Enabled = false;
            progress.Style = ProgressBarStyle.Marquee;
            try
            {
                bool existing = await Task.Run(() => IsNexusReady());
                if (closing) return;
                if (existing)
                {
                    OpenBrowser();
                    Close();
                    return;
                }
                await Task.Run(() => StartServer());
                if (closing) return;
                ready = true;
                progress.Style = ProgressBarStyle.Continuous;
                progress.Value = 100;
                status.Text = "Serveur actif sur le port " + port + ".\nCliquez sur Arrêter pour fermer le serveur.";
                open.Enabled = true;
                OpenBrowser();
            }
            catch (Exception ex)
            {
                if (closing) return;
                StopChild();
                progress.Style = ProgressBarStyle.Continuous;
                progress.Value = 0;
                status.Text = "Démarrage impossible : " + ex.Message;
                retry.Enabled = true;
                Show();
                Activate();
            }
        }

        private void StartServer()
        {
            if (!File.Exists(Path.Combine(root, "package.json")) || !File.Exists(Path.Combine(root, "vite.config.ts")))
                throw new InvalidOperationException("placez l’exécutable à la racine du projet MP Nexus.");
            if (!OnPath("node.exe") || !OnPath("npm.cmd"))
                throw new InvalidOperationException("installez Node.js, puis relancez l’exécutable.");
            if (!File.Exists(Path.Combine(root, "node_modules", "vite", "bin", "vite.js")))
            {
                SetStatus("Installation des dépendances du projet…");
                var install = StartCommand("npm ci");
                install.WaitForExit();
                install.WaitForExit(); // Let asynchronous output handlers finish.
                int code = install.ExitCode;
                lock (childLock) if (child == install) child = null;
                install.Dispose();
                if (code != 0) throw new InvalidOperationException("npm ci a échoué. " + LastLog());
            }
            if (closing) return;
            SetStatus("Démarrage du serveur sur le port " + port + "…");
            var server = StartCommand("npm run dev -- --port " + port + " --strictPort");
            for (int attempt = 0; attempt < 150; attempt++)
            {
                if (closing) return;
                if (IsNexusReady()) return;
                if (server.HasExited) throw new InvalidOperationException("le serveur s’est arrêté. " + LastLog());
                Thread.Sleep(200);
            }
            throw new TimeoutException("le serveur ne répond pas sur le port " + port + ". " + LastLog());
        }

        private Process StartCommand(string command)
        {
            var start = new ProcessStartInfo("cmd.exe", "/d /s /c \"" + command + "\"");
            start.WorkingDirectory = root;
            start.UseShellExecute = false;
            start.CreateNoWindow = true;
            start.RedirectStandardOutput = true;
            start.RedirectStandardError = true;
            var process = new Process { StartInfo = start };
            process.OutputDataReceived += delegate(object sender, DataReceivedEventArgs args) { AddLog(args.Data); };
            process.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs args) { AddLog(args.Data); };
            lock (childLock)
            {
                if (closing) throw new OperationCanceledException();
                process.Start();
                child = process;
                process.BeginOutputReadLine();
                process.BeginErrorReadLine();
            }
            return process;
        }

        private bool IsNexusReady()
        {
            try
            {
                using (var client = new TcpClient())
                {
                    client.ReceiveTimeout = 1000;
                    client.SendTimeout = 1000;
                    client.Connect(IPAddress.Loopback, port);
                    using (var stream = client.GetStream())
                    {
                        byte[] request = Encoding.ASCII.GetBytes("GET / HTTP/1.0\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n");
                        stream.Write(request, 0, request.Length);
                        var response = new MemoryStream();
                        var buffer = new byte[2048];
                        int count;
                        while ((count = stream.Read(buffer, 0, buffer.Length)) > 0 && response.Length < 8192)
                        {
                            response.Write(buffer, 0, count);
                            string partial = Encoding.UTF8.GetString(response.ToArray());
                            if (partial.StartsWith("HTTP/1.1 200 ") && partial.Contains("MP Nexus")) return true;
                        }
                        string page = Encoding.UTF8.GetString(response.ToArray());
                        return page.StartsWith("HTTP/1.1 200 ") && page.Contains("MP Nexus");
                    }
                }
            }
            catch (SocketException) { return false; }
            catch (IOException) { return false; }
        }

        private static bool OnPath(string executable)
        {
            foreach (var directory in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator))
                if (!string.IsNullOrWhiteSpace(directory) && File.Exists(Path.Combine(directory.Trim().Trim('"'), executable))) return true;
            return false;
        }

        private void SetStatus(string message)
        {
            if (IsHandleCreated && !closing) BeginInvoke((MethodInvoker)delegate { status.Text = message; });
        }

        private void AddLog(string line)
        {
            if (line == null) return;
            lock (logLock)
            {
                log.AppendLine(line);
                if (log.Length > 3000) log.Remove(0, log.Length - 3000);
            }
        }

        private string LastLog()
        {
            lock (logLock) return log.ToString().Trim();
        }

        private void OpenBrowser()
        {
            if (!ready && !IsNexusReady()) return;
            if (Environment.GetEnvironmentVariable("MP_NEXUS_LAUNCHER_NO_BROWSER") == "1") return;
            try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); }
            catch (Exception ex) { status.Text = "Ouvrez " + url + " dans votre navigateur. " + ex.Message; Show(); }
        }

        private void StopChild()
        {
            Process process;
            lock (childLock)
            {
                process = child;
                child = null;
            }
            if (process == null) return;
            try
            {
                if (!process.HasExited)
                {
                    var start = new ProcessStartInfo("taskkill.exe", "/PID " + process.Id + " /T /F") { UseShellExecute = false, CreateNoWindow = true };
                    using (var kill = Process.Start(start)) kill.WaitForExit(5000);
                }
            }
            catch (InvalidOperationException) { }
            catch (System.ComponentModel.Win32Exception) { }
            finally { process.Dispose(); }
        }
    }
}
