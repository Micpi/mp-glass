using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace MpNexus.Launcher;

internal sealed class PortalStore
{
    private const int PasswordIterations = 310_000;
    private static readonly TimeSpan SessionLifetime = TimeSpan.FromHours(12);
    private static readonly TimeSpan Retention = TimeSpan.FromDays(180);
    private readonly string filePath;
    private readonly SemaphoreSlim gate = new(1, 1);
    private readonly JsonSerializerOptions json = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    public PortalStore(string dataDirectory) => filePath = Path.Combine(dataDirectory, "accounts.json");

    public async Task InitializeAsync(string adminUsername, string? adminPassword)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(filePath)!);
        await gate.WaitAsync();
        try
        {
            var state = await ReadAsync();
            if (state.Users.Count == 0)
            {
                if (string.IsNullOrWhiteSpace(adminPassword))
                    throw new InvalidOperationException("Créez le premier compte administrateur en définissant MP_NEXUS_ADMIN_PASSWORD dans les variables du projet Synology, puis redémarrez le conteneur.");
                if (!ValidUsername(Normalize(adminUsername)) || !ValidPassword(adminPassword))
                    throw new InvalidOperationException("Le premier compte nécessite un nom valide (3 à 32 caractères) et un mot de passe d’au moins 12 caractères.");
                state.Users.Add(NewUser(adminUsername, "admin", adminPassword, mustChangePassword: false));
            }
            Prune(state);
            await WriteAsync(state);
        }
        finally { gate.Release(); }
    }

    public async Task<UserRecord?> FindUserAsync(string username)
    {
        await gate.WaitAsync();
        try { return (await ReadAsync()).Users.FirstOrDefault(user => user.Enabled && Normalize(user.Username) == Normalize(username)); }
        finally { gate.Release(); }
    }

    public static bool VerifyPassword(string password, string stored)
    {
        try
        {
            var parts = stored.Split(':');
            if (parts.Length != 4 || parts[0] != "pbkdf2-sha256" || !int.TryParse(parts[1], out var iterations)) return false;
            var salt = Convert.FromBase64String(parts[2]);
            var expected = Convert.FromBase64String(parts[3]);
            var actual = Rfc2898DeriveBytes.Pbkdf2(Encoding.UTF8.GetBytes(password), salt, iterations, HashAlgorithmName.SHA256, expected.Length);
            return CryptographicOperations.FixedTimeEquals(actual, expected);
        }
        catch (FormatException) { return false; }
    }

    public async Task<SessionRecord?> StartSessionAsync(string userId)
    {
        await gate.WaitAsync();
        try
        {
            var state = await ReadAsync();
            var user = state.Users.FirstOrDefault(item => item.Id == userId && item.Enabled);
            if (user is null) return null;
            var now = DateTimeOffset.UtcNow;
            user.LastLoginAt = now;
            var session = new SessionRecord { Id = Guid.NewGuid().ToString("N"), UserId = user.Id, StartedAt = now, LastSeenAt = now };
            state.Sessions.Add(session);
            Prune(state);
            await WriteAsync(state);
            return session;
        }
        finally { gate.Release(); }
    }

    public async Task<bool> ValidateIdentityAsync(string userId, string stamp, string role)
    {
        await gate.WaitAsync();
        try
        {
            var user = (await ReadAsync()).Users.FirstOrDefault(item => item.Id == userId && item.Enabled);
            return user is not null && user.SecurityStamp == stamp && user.Role == role;
        }
        finally { gate.Release(); }
    }

    public async Task TouchSessionAsync(string sessionId, bool openedPlan)
    {
        await gate.WaitAsync();
        try
        {
            var state = await ReadAsync();
            var session = state.Sessions.FirstOrDefault(item => item.Id == sessionId && item.EndedAt is null);
            if (session is null) return;
            var now = DateTimeOffset.UtcNow;
            var changed = now - session.LastSeenAt >= TimeSpan.FromMinutes(1);
            if (changed) session.LastSeenAt = now;
            if (openedPlan) session.PlanOpens++;
            if (!changed && !openedPlan) return;
            Prune(state);
            await WriteAsync(state);
        }
        finally { gate.Release(); }
    }

    public async Task EndSessionAsync(string sessionId)
    {
        await gate.WaitAsync();
        try
        {
            var state = await ReadAsync();
            var session = state.Sessions.FirstOrDefault(item => item.Id == sessionId && item.EndedAt is null);
            if (session is null) return;
            session.LastSeenAt = DateTimeOffset.UtcNow;
            session.EndedAt = session.LastSeenAt;
            await WriteAsync(state);
        }
        finally { gate.Release(); }
    }

    public async Task<(bool Success, string Error)> AddUserAsync(string username, string password, string role)
    {
        var normalized = Normalize(username);
        if (!ValidUsername(normalized)) return (false, "Le nom doit faire 3 à 32 caractères : lettres, chiffres, point, tiret ou soulignement.");
        if (!ValidPassword(password)) return (false, "Choisissez un mot de passe d’au moins 12 caractères.");
        if (role is not ("user" or "admin")) return (false, "Rôle inconnu.");
        await gate.WaitAsync();
        try
        {
            var state = await ReadAsync();
            if (state.Users.Any(item => Normalize(item.Username) == normalized)) return (false, "Ce nom d’utilisateur existe déjà.");
            state.Users.Add(NewUser(username.Trim(), role, password, mustChangePassword: true));
            await WriteAsync(state);
            return (true, "");
        }
        finally { gate.Release(); }
    }

    public async Task<(bool Success, string Error)> ChangePasswordAsync(string userId, string currentPassword, string newPassword)
    {
        if (!ValidPassword(newPassword)) return (false, "Choisissez un mot de passe d’au moins 12 caractères.");
        await gate.WaitAsync();
        try
        {
            var state = await ReadAsync();
            var user = state.Users.FirstOrDefault(item => item.Id == userId && item.Enabled);
            if (user is null || !VerifyPassword(currentPassword, user.PasswordHash)) return (false, "Le mot de passe actuel est incorrect.");
            user.PasswordHash = HashPassword(newPassword);
            user.MustChangePassword = false;
            user.SecurityStamp = NewStamp();
            await WriteAsync(state);
            return (true, "");
        }
        finally { gate.Release(); }
    }

    public async Task<(bool Success, string Error)> ResetPasswordAsync(string userId, string password)
    {
        if (!ValidPassword(password)) return (false, "Choisissez un mot de passe temporaire d’au moins 12 caractères.");
        await gate.WaitAsync();
        try
        {
            var state = await ReadAsync();
            var user = state.Users.FirstOrDefault(item => item.Id == userId && item.Enabled);
            if (user is null) return (false, "Utilisateur introuvable.");
            user.PasswordHash = HashPassword(password);
            user.MustChangePassword = true;
            user.SecurityStamp = NewStamp();
            await WriteAsync(state);
            return (true, "");
        }
        finally { gate.Release(); }
    }

    public async Task<(bool Success, string Error)> SetRoleAsync(string userId, string role, string currentUserId)
    {
        if (role is not ("user" or "admin")) return (false, "Rôle inconnu.");
        await gate.WaitAsync();
        try
        {
            var state = await ReadAsync();
            var user = state.Users.FirstOrDefault(item => item.Id == userId && item.Enabled);
            if (user is null) return (false, "Utilisateur introuvable.");
            if (user.Id == currentUserId && role != "admin") return (false, "Vous ne pouvez pas retirer votre propre rôle administrateur.");
            if (user.Role == "admin" && role != "admin" && state.Users.Count(item => item.Enabled && item.Role == "admin") <= 1)
                return (false, "Conservez au moins un administrateur.");
            user.Role = role;
            user.SecurityStamp = NewStamp();
            await WriteAsync(state);
            return (true, "");
        }
        finally { gate.Release(); }
    }

    public async Task<(bool Success, string Error)> DeleteUserAsync(string userId, string currentUserId)
    {
        await gate.WaitAsync();
        try
        {
            var state = await ReadAsync();
            var user = state.Users.FirstOrDefault(item => item.Id == userId && item.Enabled);
            if (user is null) return (false, "Utilisateur introuvable.");
            if (user.Id == currentUserId) return (false, "Vous ne pouvez pas supprimer votre propre compte.");
            if (user.Role == "admin" && state.Users.Count(item => item.Enabled && item.Role == "admin") <= 1)
                return (false, "Conservez au moins un administrateur.");
            user.Enabled = false;
            user.SecurityStamp = NewStamp();
            foreach (var session in state.Sessions.Where(item => item.UserId == userId && item.EndedAt is null)) session.EndedAt = DateTimeOffset.UtcNow;
            await WriteAsync(state);
            return (true, "");
        }
        finally { gate.Release(); }
    }

    public async Task<PortalUser[]> ListUsersAsync()
    {
        await gate.WaitAsync();
        try { return (await ReadAsync()).Users.Where(user => user.Enabled).OrderBy(user => user.Username).Select(user => new PortalUser(user.Id, user.Username, user.Role, user.CreatedAt, user.LastLoginAt, user.MustChangePassword)).ToArray(); }
        finally { gate.Release(); }
    }

    public async Task<PortalAnalytics> GetAnalyticsAsync()
    {
        await gate.WaitAsync();
        try
        {
            var state = await ReadAsync();
            var now = DateTimeOffset.UtcNow;
            var since = now.AddDays(-30);
            var users = state.Users.Where(user => user.Enabled).Select(user =>
            {
                var sessions = state.Sessions.Where(session => session.UserId == user.Id && session.StartedAt >= since).ToArray();
                var minutes = sessions.Sum(DurationMinutes);
                return new PortalUserAnalytics(user.Id, user.Username, user.Role, user.LastLoginAt, sessions.Length, sessions.Sum(session => session.PlanOpens), minutes);
            }).OrderByDescending(user => user.LastLoginAt).ToArray();
            var sessions30 = state.Sessions.Where(session => session.StartedAt >= since).ToArray();
            return new PortalAnalytics(users.Length,
                state.Users.Count(user => user.Enabled && user.LastLoginAt >= now.AddDays(-7)),
                sessions30.Count(session => session.StartedAt >= now.AddDays(-7)),
                sessions30.Where(session => session.StartedAt >= now.AddDays(-7)).Sum(session => session.PlanOpens),
                users,
                Enumerable.Range(0, 14).Select(offset =>
                {
                    var day = DateOnly.FromDateTime(now.UtcDateTime).AddDays(-13 + offset);
                    var daily = state.Sessions.Where(session => DateOnly.FromDateTime(session.StartedAt.UtcDateTime) == day).ToArray();
                    return new PortalDay(day.ToString("yyyy-MM-dd"), daily.Length, daily.Sum(session => session.PlanOpens));
                }).ToArray());
        }
        finally { gate.Release(); }
    }

    public async Task<PortalUser?> GetCurrentUserAsync(string id)
    {
        await gate.WaitAsync();
        try
        {
            var user = (await ReadAsync()).Users.FirstOrDefault(item => item.Id == id && item.Enabled);
            return user is null ? null : new PortalUser(user.Id, user.Username, user.Role, user.CreatedAt, user.LastLoginAt, user.MustChangePassword);
        }
        finally { gate.Release(); }
    }

    private async Task<PortalState> ReadAsync()
    {
        if (!File.Exists(filePath)) return new PortalState();
        await using var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read, 16_384, useAsync: true);
        return await JsonSerializer.DeserializeAsync<PortalState>(stream, json) ?? new PortalState();
    }

    private async Task WriteAsync(PortalState state)
    {
        var temporaryPath = filePath + ".tmp";
        await using (var stream = new FileStream(temporaryPath, FileMode.Create, FileAccess.Write, FileShare.None, 16_384, useAsync: true))
        {
            await JsonSerializer.SerializeAsync(stream, state, json);
            await stream.FlushAsync();
        }
        File.Move(temporaryPath, filePath, overwrite: true);
    }

    private static void Prune(PortalState state)
    {
        var before = DateTimeOffset.UtcNow - Retention;
        state.Sessions.RemoveAll(session => session.StartedAt < before);
        if (state.Sessions.Count > 5_000)
            state.Sessions.RemoveRange(0, state.Sessions.Count - 5_000);
    }

    private static double DurationMinutes(SessionRecord session)
    {
        var end = session.EndedAt ?? session.LastSeenAt;
        return Math.Round(Math.Max(0, Math.Min(SessionLifetime.TotalMinutes, (end - session.StartedAt).TotalMinutes)), 1);
    }

    private static UserRecord NewUser(string username, string role, string password, bool mustChangePassword) => new()
    {
        Id = Guid.NewGuid().ToString("N"), Username = username.Trim(), Role = role, PasswordHash = HashPassword(password),
        CreatedAt = DateTimeOffset.UtcNow, SecurityStamp = NewStamp(), MustChangePassword = mustChangePassword
    };

    private static string HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(Encoding.UTF8.GetBytes(password), salt, PasswordIterations, HashAlgorithmName.SHA256, 32);
        return $"pbkdf2-sha256:{PasswordIterations}:{Convert.ToBase64String(salt)}:{Convert.ToBase64String(hash)}";
    }

    private static string NewStamp() => Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
    private static string Normalize(string username) => username.Trim().ToLowerInvariant();
    private static bool ValidUsername(string username) => username.Length is >= 3 and <= 32 && username.All(character => char.IsAsciiLetterOrDigit(character) || character is '.' or '-' or '_');
    private static bool ValidPassword(string password) => password.Length is >= 12 and <= 128;
}

internal sealed class PortalState
{
    public List<UserRecord> Users { get; set; } = [];
    public List<SessionRecord> Sessions { get; set; } = [];
}

internal sealed class UserRecord
{
    public string Id { get; set; } = "";
    public string Username { get; set; } = "";
    public string Role { get; set; } = "user";
    public string PasswordHash { get; set; } = "";
    public string SecurityStamp { get; set; } = "";
    public bool MustChangePassword { get; set; }
    public bool Enabled { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? LastLoginAt { get; set; }
}

internal sealed class SessionRecord
{
    public string Id { get; set; } = "";
    public string UserId { get; set; } = "";
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset LastSeenAt { get; set; }
    public DateTimeOffset? EndedAt { get; set; }
    public int PlanOpens { get; set; }
}

internal sealed record PortalUser(string Id, string Username, string Role, DateTimeOffset CreatedAt, DateTimeOffset? LastLoginAt, bool MustChangePassword);
internal sealed record PortalUserAnalytics(string Id, string Username, string Role, DateTimeOffset? LastLoginAt, int Sessions30Days, int PlanOpens30Days, double Minutes30Days);
internal sealed record PortalDay(string Day, int Sessions, int PlanOpens);
internal sealed record PortalAnalytics(int AccountCount, int ActiveUsers7Days, int Sessions7Days, int PlanOpens7Days, PortalUserAnalytics[] Users, PortalDay[] Days);
