// Forum Platform - Core Auth & Data Simulation (Expanded v2.0)

const ForumDB = {
    // --- Session ---
    getSession: () => JSON.parse(localStorage.getItem('forum_session')) || null,
    setSession: (user) => localStorage.setItem('forum_session', JSON.stringify(user)),
    logout: () => {
        localStorage.removeItem('forum_session');
        const isPage = window.location.pathname.includes('/pages/');
        window.location.href = isPage ? '../index.html' : 'index.html';
    },

    // --- Permissions ---
    isCommitteeMember: (user) => {
        if (!user) return false;
        return ['committee_member', 'committee_head', 'admin'].includes(user.role);
    },

    // --- XP & Leveling System ---
    XP_CONFIG: {
        daily_login: { points: 5, label: 'Günlük Giriş', limit: 5 },
        event_attendance: { points: 20, label: 'Etkinliğe Katılım' },
        project_join: { points: 40, label: 'Projeye Katılım' },
        task_complete: { points: 25, label: 'Görev Tamamlama' },
        project_create: { points: 60, label: 'Proje Başlatma' },
        event_organize: { points: 80, label: 'Etkinlik Düzenleme' },
        idea_share: { points: 15, label: 'Fikir Paylaşma' },
        comment_write: { points: 5, label: 'Yorum Yazma', limit: 30 }
    },

    LEVEL_CONFIG: [
        { level: 1, minXP: 0, title: 'Yeni Üye', badge: 'starter' },
        { level: 2, minXP: 100, title: 'Katılımcı', badge: 'contributor' },
        { level: 3, minXP: 300, title: 'Aktif Üye', badge: 'active_member' },
        { level: 4, minXP: 600, title: 'Topluluk Destekçisi', badge: 'supporter' },
        { level: 5, minXP: 1000, title: 'Lider', badge: 'leader' },
        { level: 6, minXP: 2000, title: 'Topluluk Elçisi', badge: 'ambassador' }
    ],

    // --- Tüm Forum Verisini Yedekleme / Geri Yükleme ---
    exportAllData: () => {
        const keys = [
            'forum_users',
            'forum_projects',
            'forum_tasks',
            'forum_trash',
            'forum_ideas',
            'forum_applications',
            'forum_announcements',
            'forum_custom_badges',
            'forum_bans',
            'forum_restrictions',
            'forum_reports',
            'forum_mod_logs'
        ];
        const snapshot = {};
        keys.forEach(k => {
            const raw = localStorage.getItem(k);
            if (raw !== null && raw !== undefined) {
                snapshot[k] = raw;
            }
        });
        return JSON.stringify({
            createdAt: new Date().toISOString(),
            version: 'v1',
            data: snapshot
        }, null, 2);
    },

    importAllData: (jsonString) => {
        if (!jsonString) return false;
        let payload;
        try {
            payload = JSON.parse(jsonString);
        } catch {
            return false;
        }
        const data = payload.data || payload;
        if (!data || typeof data !== 'object') return false;
        Object.entries(data).forEach(([key, value]) => {
            if (typeof value === 'string') {
                localStorage.setItem(key, value);
            } else {
                localStorage.setItem(key, JSON.stringify(value));
            }
        });
        return true;
    },

    // --- Moderasyon: veri yardımcıları ---
    getBans: () => {
        try {
            const list = JSON.parse(localStorage.getItem('forum_bans')) || [];
            return Array.isArray(list) ? list : [];
        } catch {
            localStorage.removeItem('forum_bans');
            return [];
        }
    },
    saveBans: (bans) => localStorage.setItem('forum_bans', JSON.stringify(bans || [])),

    getRestrictions: () => {
        try {
            const list = JSON.parse(localStorage.getItem('forum_restrictions')) || [];
            return Array.isArray(list) ? list : [];
        } catch {
            localStorage.removeItem('forum_restrictions');
            return [];
        }
    },
    saveRestrictions: (r) => localStorage.setItem('forum_restrictions', JSON.stringify(r || [])),

    getReports: () => {
        try {
            const list = JSON.parse(localStorage.getItem('forum_reports')) || [];
            return Array.isArray(list) ? list : [];
        } catch {
            localStorage.removeItem('forum_reports');
            return [];
        }
    },
    saveReports: (r) => localStorage.setItem('forum_reports', JSON.stringify(r || [])),

    getModLogs: () => {
        try {
            const list = JSON.parse(localStorage.getItem('forum_mod_logs')) || [];
            return Array.isArray(list) ? list : [];
        } catch {
            localStorage.removeItem('forum_mod_logs');
            return [];
        }
    },
    saveModLogs: (logs) => localStorage.setItem('forum_mod_logs', JSON.stringify(logs || [])),

    logModAction: ({ adminId, targetUserId, action, details }) => {
        const logs = ForumDB.getModLogs();
        logs.unshift({
            id: Date.now(),
            adminId: Number(adminId),
            targetUserId: targetUserId != null ? Number(targetUserId) : null,
            action,
            details: details || '',
            createdAt: new Date().toISOString()
        });
        ForumDB.saveModLogs(logs);
    },

    // --- Ban / Restriction helper’ları ---
    isUserBanned: (userId) => {
        const bans = ForumDB.getBans();
        const now = Date.now();
        return bans.some(b => {
            if (Number(b.userId) !== Number(userId)) return false;
            if (b.type === 'permanent') return true;
            return b.expiresAt && new Date(b.expiresAt).getTime() > now;
        });
    },

    getActiveRestrictions: (userId) => {
        const list = ForumDB.getRestrictions();
        const now = Date.now();
        return list.filter(r => {
            if (Number(r.userId) !== Number(userId)) return false;
            if (!r.expiresAt) return true;
            return new Date(r.expiresAt).getTime() > now;
        });
    },

    canUser: (action, userId) => {
        if (ForumDB.isUserBanned(userId)) return false;
        const restrictions = ForumDB.getActiveRestrictions(userId);
        if (action === 'comment') {
            return !restrictions.some(r => r.type === 'comments');
        }
        if (action === 'message') {
            return !restrictions.some(r => r.type === 'messages');
        }
        if (action === 'project_apply') {
            return !restrictions.some(r => r.type === 'project_applications');
        }
        // Diğer aksiyonlar için şimdilik sadece ban kontrolü
        return true;
    },

    banUser: (userId, durationDays, reason, adminId) => {
        const bans = ForumDB.getBans();
        const now = new Date();
        let type = 'temporary';
        let expiresAt = null;
        if (durationDays === 'permanent') {
            type = 'permanent';
        } else {
            const d = new Date(now.getTime() + Number(durationDays || 0) * 24 * 60 * 60 * 1000);
            expiresAt = d.toISOString();
        }
        bans.push({
            id: Date.now(),
            userId: Number(userId),
            type,
            reason: reason || '',
            createdAt: now.toISOString(),
            createdBy: Number(adminId),
            expiresAt
        });
        ForumDB.saveBans(bans);
        ForumDB.logModAction({
            adminId,
            targetUserId: userId,
            action: 'ban',
            details: `Kullanıcı banlandı (${type}, süre: ${durationDays} gün).`
        });
        try {
            ForumDB.logGovernanceActivity({
                type: 'moderasyon_ban',
                title: `Kullanıcı #${userId} banlandı`,
                description: `Tür: ${type}, süre: ${durationDays} gün.`
            });
        } catch (e) {}
    },

    unbanUser: (banId, adminId) => {
        const bans = ForumDB.getBans();
        const ban = bans.find(b => Number(b.id) === Number(banId));
        const filtered = bans.filter(b => Number(b.id) !== Number(banId));
        ForumDB.saveBans(filtered);
        if (ban) {
            ForumDB.logModAction({
                adminId,
                targetUserId: ban.userId,
                action: 'unban',
                details: 'Ban kaldırıldı.'
            });
            try {
                ForumDB.logGovernanceActivity({
                    type: 'moderasyon_unban',
                    title: `Kullanıcı #${ban.userId} için ban kaldırıldı`,
                    description: ''
                });
            } catch (e) {}
        }
    },

    addRestriction: (userId, type, durationDays, reason, adminId) => {
        const list = ForumDB.getRestrictions();
        const now = new Date();
        const expiresAt = durationDays
            ? new Date(now.getTime() + Number(durationDays) * 24 * 60 * 60 * 1000).toISOString()
            : null;
        list.push({
            id: Date.now(),
            userId: Number(userId),
            type, // 'comments' | 'messages' | 'project_applications'
            reason: reason || '',
            createdAt: now.toISOString(),
            createdBy: Number(adminId),
            expiresAt
        });
        ForumDB.saveRestrictions(list);
        ForumDB.logModAction({
            adminId,
            targetUserId: userId,
            action: 'restrict',
            details: `Sınırlama eklendi: ${type}, süre: ${durationDays || 'belirtilmedi'} gün.`
        });
    },

    removeRestriction: (restrictionId, adminId) => {
        const list = ForumDB.getRestrictions();
        const r = list.find(x => Number(x.id) === Number(restrictionId));
        const filtered = list.filter(x => Number(x.id) !== Number(restrictionId));
        ForumDB.saveRestrictions(filtered);
        if (r) {
            ForumDB.logModAction({
                adminId,
                targetUserId: r.userId,
                action: 'unrestrict',
                details: `Sınırlama kaldırıldı: ${r.type}.`
            });
        }
    },

    warnUser: (userId, reason, adminId) => {
        const users = ForumDB.getUsers();
        const idx = users.findIndex(u => Number(u.id) === Number(userId));
        if (idx === -1) return;
        const u = users[idx];
        u.warningsCount = (u.warningsCount || 0) + 1;
        if (!u.notifications) u.notifications = [];
        u.notifications.unshift({
            id: Date.now(),
            type: 'warning',
            message: reason || 'Platform kurallarını ihlal ettiğiniz için uyarı aldınız.',
            createdAt: new Date().toISOString(),
            read: false
        });
        localStorage.setItem('forum_users', JSON.stringify(users));

        ForumDB.logModAction({
            adminId,
            targetUserId: userId,
            action: 'warn',
            details: `Uyarı gönderildi. Toplam uyarı: ${u.warningsCount}`
        });

        // 3. uyarıda otomatik kısa kısıtlama
        if (u.warningsCount >= 3) {
            ForumDB.addRestriction(userId, 'comments', 1, '3 uyarı sonrası otomatik yorum kısıtı', adminId);
        }
    },

    reportContent: ({ reporterId, targetType, targetId, targetUserId, reason, message }) => {
        const reports = ForumDB.getReports();
        reports.unshift({
            id: Date.now(),
            reporterId: Number(reporterId),
            targetUserId: targetUserId != null ? Number(targetUserId) : null,
            targetType,   // 'idea' | 'comment' | 'project' | 'user'
            targetId: Number(targetId),
            reason,       // 'spam' | 'abuse' | 'inappropriate' | 'misinfo' | 'other'
            message: message || '',
            status: 'open',
            createdAt: new Date().toISOString(),
            handledBy: null,
            handledAt: null,
            actionTaken: null
        });
        ForumDB.saveReports(reports);
    },

    resolveReport: (reportId, { action, adminId }) => {
        const reports = ForumDB.getReports();
        const idx = reports.findIndex(r => Number(r.id) === Number(reportId));
        if (idx === -1) return;
        reports[idx].status = 'closed';
        reports[idx].handledBy = Number(adminId);
        reports[idx].handledAt = new Date().toISOString();
        reports[idx].actionTaken = action || '';
        ForumDB.saveReports(reports);

        ForumDB.logModAction({
            adminId,
            targetUserId: reports[idx].targetUserId,
            action: 'resolve_report',
            details: `Rapor kapatıldı. Alınan aksiyon: ${action || 'belirtilmedi'}.`
        });
    },

    // --- Custom Badges (admin panel) ---
    getCustomBadges: () => {
        try {
            const list = JSON.parse(localStorage.getItem('forum_custom_badges')) || [];
            return Array.isArray(list) ? list : [];
        } catch (e) {
            localStorage.removeItem('forum_custom_badges');
            return [];
        }
    },
    createCustomBadge: ({ name, description, requiredXP }) => {
        const badges = ForumDB.getCustomBadges();
        const id = Date.now();
        const key = `custom_${id}`;
        const badge = {
            id,
            key,
            name,
            description: description || '',
            requiredXP: Number(requiredXP) || 0
        };
        badges.push(badge);
        localStorage.setItem('forum_custom_badges', JSON.stringify(badges));

        // After creating a badge, retro-assign it to all eligible users
        const users = ForumDB.getUsers();
        let changed = false;
        users.forEach(u => {
            if (!u.badges) u.badges = [];
            if ((u.xp || 0) >= badge.requiredXP && !u.badges.includes(key)) {
                u.badges.push(key);
                if (!u.notifications) u.notifications = [];
                u.notifications.unshift({
                    id: Date.now(),
                    type: 'badge_unlocked',
                    message: `Yeni rozet kazandın: ${badge.name}`,
                    createdAt: new Date().toISOString(),
                    read: false
                });
                changed = true;
            }
        });
        if (changed) {
            localStorage.setItem('forum_users', JSON.stringify(users));
        }
        return badge;
    },

    // --- Streak helpers ---
    _updateStreakForUser: (user, activityType) => {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const last = user.lastStreakDate ? user.lastStreakDate.split('T')[0] : null;
        const oneDayMs = 24 * 60 * 60 * 1000;

        if (!user.streakCurrent) user.streakCurrent = 0;
        if (!user.streakBest) user.streakBest = 0;

        // Anti-spam: aynı gün içinde sadece ilk anlamlı aktivite seriye yazılsın
        if (last === today) {
            user.lastStreakActivity = activityType;
            user.lastActiveAt = now.toISOString();
            return;
        }

        if (!last) {
            // İlk aktivite
            user.streakCurrent = 1;
        } else {
            const lastDate = new Date(user.lastStreakDate);
            const diffDays = Math.floor((now - lastDate) / oneDayMs);
            if (diffDays === 1) {
                user.streakCurrent += 1;
            } else if (diffDays > 1) {
                // Seri bozulmuş
                user.streakCurrent = 1;
            }
        }

        if (user.streakCurrent > user.streakBest) {
            user.streakBest = user.streakCurrent;
        }

        user.lastStreakDate = now.toISOString();
        user.lastStreakActivity = activityType;
        user.lastActiveAt = now.toISOString();

        // Ödüller
        const rewards = [
            { days: 3, xp: 20, badge: null },
            { days: 7, xp: 0, badge: 'streak_7' },
            { days: 14, xp: 40, badge: null },
            { days: 30, xp: 0, badge: 'streak_30' },
            { days: 60, xp: 0, badge: 'streak_60_premium' },
            { days: 100, xp: 0, badge: 'streak_100_legend' }
        ];

        const justHit = rewards.find(r => r.days === user.streakCurrent);
        if (justHit) {
            if (justHit.xp) {
                user.xp = (user.xp || 0) + justHit.xp;
            }
            if (justHit.badge) {
                if (!user.badges) user.badges = [];
                if (!user.badges.includes(justHit.badge)) {
                    user.badges.push(justHit.badge);
                }
            }
            if (!user.notifications) user.notifications = [];
            user.notifications.unshift({
                id: Date.now() + 5,
                type: 'streak_reward',
                message: `${user.streakCurrent} günlük seriye ulaştın!`,
                createdAt: now.toISOString(),
                read: false
            });
        }
    },

    getUserStreakInfo: (userId) => {
        const users = ForumDB.getUsers();
        const u = users.find(x => Number(x.id) === Number(userId));
        if (!u) return { current: 0, best: 0, lastActivityAt: null };
        return {
            current: u.streakCurrent || 0,
            best: u.streakBest || 0,
            lastActivityAt: u.lastActiveAt || null
        };
    },

    addXP: (userId, activityType) => {
        const users = ForumDB.getUsers();
        const userIndex = users.findIndex(u => Number(u.id) === Number(userId));
        if (userIndex === -1) return null;

        const config = ForumDB.XP_CONFIG[activityType];
        if (!config) return null;

        const today = new Date().toISOString().split('T')[0];
        if (!users[userIndex].xpHistory) users[userIndex].xpHistory = [];
        if (!users[userIndex].xp) users[userIndex].xp = 0;
        if (!users[userIndex].level) users[userIndex].level = 1;
        if (!users[userIndex].badges) users[userIndex].badges = [];

        // Check Daily Limit
        if (config.limit) {
            const todayXP = users[userIndex].xpHistory
                .filter(h => h.date.startsWith(today) && h.type === activityType)
                .reduce((sum, h) => sum + h.points, 0);
            if (todayXP >= config.limit) return { limited: true };
        }

        // Add XP
        const earnedPoints = config.points;
        users[userIndex].xp += earnedPoints;
        users[userIndex].xpHistory.unshift({
            id: Date.now(),
            type: activityType,
            label: config.label,
            points: earnedPoints,
            date: new Date().toISOString()
        });

        // Level Up Check
        let newLevel = users[userIndex].level;
        for (const lvl of ForumDB.LEVEL_CONFIG) {
            if (users[userIndex].xp >= lvl.minXP) {
                newLevel = lvl.level;
            }
        }

        const leveledUp = newLevel > users[userIndex].level;
        if (leveledUp) {
            users[userIndex].level = newLevel;
            // Add Badge for level if not exists
            const lvlBadge = ForumDB.LEVEL_CONFIG.find(l => l.level === newLevel).badge;
            if (!users[userIndex].badges.includes(lvlBadge)) {
                users[userIndex].badges.push(lvlBadge);
            }
            
            // Add Notification
            if (!users[userIndex].notifications) users[userIndex].notifications = [];
            users[userIndex].notifications.unshift({
                id: Date.now() + 1,
                type: 'level_up',
                message: `Tebrikler! Seviye atladın: ${ForumDB.LEVEL_CONFIG.find(l => l.level === newLevel).title}`,
                createdAt: new Date().toISOString(),
                read: false
            });
        }

        // Custom badge check: assign any XP-based custom badges not yet owned
        const customBadges = ForumDB.getCustomBadges();
        const userBadges = users[userIndex].badges;
        customBadges.forEach(b => {
            if ((users[userIndex].xp || 0) >= (b.requiredXP || 0) && !userBadges.includes(b.key)) {
                userBadges.push(b.key);
                if (!users[userIndex].notifications) users[userIndex].notifications = [];
                users[userIndex].notifications.unshift({
                    id: Date.now() + 2,
                    type: 'badge_unlocked',
                    message: `Yeni rozet kazandın: ${b.name}`,
                    createdAt: new Date().toISOString(),
                    read: false
                });
            }
        });

        // Streak update (her anlamlı XP aktivitesi seriyi tetikler)
        ForumDB._updateStreakForUser(users[userIndex], activityType);

        localStorage.setItem('forum_users', JSON.stringify(users));
        
        // Update Session
        const session = ForumDB.getSession();
        if (session && Number(session.id) === Number(userId)) {
            ForumDB.setSession(users[userIndex]);
        }

        return { earnedPoints, leveledUp, newLevel, newTitle: ForumDB.LEVEL_CONFIG.find(l => l.level === newLevel).title };
    },

    getUserXPInfo: (userId) => {
        const users = ForumDB.getUsers();
        const user = users.find(u => Number(u.id) === Number(userId));
        if (!user) return null;

        const currentLevel = ForumDB.LEVEL_CONFIG.find(l => l.level === (user.level || 1));
        const nextLevel = ForumDB.LEVEL_CONFIG.find(l => l.level === (user.level || 1) + 1);
        
        return {
            xp: user.xp || 0,
            level: user.level || 1,
            title: currentLevel.title,
            nextLevelXP: nextLevel ? nextLevel.minXP : null,
            progress: nextLevel ? Math.round(((user.xp - currentLevel.minXP) / (nextLevel.minXP - currentLevel.minXP)) * 100) : 100
        };
    },

    getLeaderboard: () => {
        return ForumDB.getUsers()
            .sort((a, b) => (b.xp || 0) - (a.xp || 0))
            .slice(0, 10);
    },

    // --- Users (Point 1: Member Profiles) ---
    getUsers: () => {
        let users;
        try {
            users = JSON.parse(localStorage.getItem('forum_users')) || [];
        } catch (e) {
            users = [];
            localStorage.removeItem('forum_users');
        }
        if (!Array.isArray(users)) users = [];
        const normalizeUser = (u) => {
            const user = u && typeof u === 'object' ? u : {};
            const arr = (v) => {
                if (Array.isArray(v)) return v;
                if (typeof v === 'string') {
                    const s = v.trim();
                    return s ? [s] : [];
                }
                if (typeof v === 'number') return Number.isFinite(v) ? [v] : [];
                return [];
            };
            return {
                ...user,
                username: (typeof user.username === 'string' && user.username.trim()) ? user.username.trim() : null,
                governanceRole: user.governanceRole || 'none', // president | vp | school_president | committee_head | none
                school: user.school || user.schoolName || null,
                role: user.role || 'member',
                joinedAt: user.joinedAt || new Date().toISOString(),
                xp: typeof user.xp === 'number' ? user.xp : (Number(user.xp) || 0),
                level: typeof user.level === 'number' ? user.level : (Number(user.level) || 1),
                xpHistory: arr(user.xpHistory),
                committees: arr(user.committees),
                projects: arr(user.projects),
                badges: arr(user.badges),
                followers: arr(user.followers),
                following: arr(user.following),
                notifications: arr(user.notifications),
                activities: arr(user.activities),
                // Settings defaults
                privacyProfile: user.privacyProfile || 'members', // public | members | followers
                privacyHideFollowers: !!user.privacyHideFollowers,
                privacyShowActivity: user.privacyShowActivity !== false,
                privacyShowOnline: user.privacyShowOnline !== false,
                privacyMessageFrom: user.privacyMessageFrom || 'everyone', // everyone | followers | none
                notifProjectInvites: user.notifProjectInvites !== false,
                notifCommitteeAnnouncements: user.notifCommitteeAnnouncements !== false,
                notifFollowers: user.notifFollowers !== false,
                notifMessages: user.notifMessages !== false,
                notifEmail: user.notifEmail === true, // varsayılan kapalı
                socialBlockedUsers: arr(user.socialBlockedUsers),
                settingsTheme: user.settingsTheme || 'dark', // dark | light | red
                settingsFontSize: user.settingsFontSize || 'md', // sm | md | lg
                settingsHomeLayout: user.settingsHomeLayout || 'default',
                settingsDashboardLayout: user.settingsDashboardLayout || 'default',
                securityLoginHistory: arr(user.securityLoginHistory),
                securityLastGlobalLogoutAt: user.securityLastGlobalLogoutAt || null,
                accountStatus: user.accountStatus || 'active',
                streakCurrent: typeof user.streakCurrent === 'number' ? user.streakCurrent : 0,
                streakBest: typeof user.streakBest === 'number' ? user.streakBest : 0,
                lastStreakDate: user.lastStreakDate || null,
                lastActiveAt: user.lastActiveAt || null
            };
        };
        const adminEmail = 'admin@forum.org';
        const adminUser = {
            id: 1,
            fullName: 'Forum Yönetici',
            email: adminEmail,
            password: 'admin',
            grade: 'Yönetim',
            interests: 'Tüm Alanlar',
            intro: 'Forum platformu genel yöneticisi.',
            role: 'admin',
            governanceRole: 'president',
            xp: 5000,
            level: 6,
            xpHistory: [],
            committees: ['bilim', 'teknoloji', 'sanat', 'sosyal', 'organizasyon'],
            projects: [],
            badges: ['founder', 'admin'],
            joinedAt: new Date().toISOString()
        };

        const adminIndex = users.findIndex(u => u.email === adminEmail);
        if (adminIndex === -1) {
            users.push(adminUser);
            localStorage.setItem('forum_users', JSON.stringify(users));
        } else if (users[adminIndex].password !== 'admin') {
            users[adminIndex].password = 'admin';
            localStorage.setItem('forum_users', JSON.stringify(users));
        }

        const normalized = users.map(normalizeUser);
        const changed = JSON.stringify(users) !== JSON.stringify(normalized);
        if (changed) {
            users = normalized;
            localStorage.setItem('forum_users', JSON.stringify(users));
        } else {
            users = normalized;
        }
        return users;
    },

    registerUser: (userData) => {
        const users = ForumDB.getUsers();

        const usernameRaw = (userData && typeof userData.username === 'string') ? userData.username.trim() : '';
        const username = usernameRaw;
        const usernameValid = /^[A-Za-z0-9]{3,}$/.test(username);
        if (!usernameValid) {
            return { error: 'Kullanıcı adı en az 3 karakter olmalı ve sadece harf/sayı içermelidir.' };
        }

        const usernameLower = username.toLowerCase();
        const usernameTaken = users.some(u => (u.username || '').toString().toLowerCase() === usernameLower);
        if (usernameTaken) {
            return { error: 'Bu kullanıcı adı zaten alınmış.' };
        }

        // Basit benzersiz email kontrolü (spam kayıtları azaltmak için)
        if (users.some(u => u.email === userData.email)) {
            return { error: 'E-posta zaten kayıtlı.' };
        }

        const newUser = { 
            id: Date.now(), 
            ...userData, 
            username,
            role: 'member',
            xp: 0,
            level: 1,
            xpHistory: [],
            committees: [], 
            projects: [],
            badges: ['new_member'],
            followers: [],
            following: [],
            notifications: [],
            activities: [],
            joinedAt: new Date().toISOString()
        };

        users.push(newUser);
        localStorage.setItem('forum_users', JSON.stringify(users));
        ForumDB.setSession(newUser);
        return newUser;
    },

    // --- Follow System & Notifications ---
    followUser: (followerId, targetId) => {
        const fId = Number(followerId);
        const tId = Number(targetId);
        const users = ForumDB.getUsers();
        const fIdx = users.findIndex(u => Number(u.id) === fId);
        const tIdx = users.findIndex(u => Number(u.id) === tId);

        if (fIdx !== -1 && tIdx !== -1 && fId !== tId) {
            if (!users[fIdx].following) users[fIdx].following = [];
            if (!users[tIdx].followers) users[tIdx].followers = [];
            
            // Check if already following (ensuring number comparison)
            const alreadyFollowing = users[fIdx].following.some(id => Number(id) === tId);
            
            if (!alreadyFollowing) {
                users[fIdx].following.push(tId);
                users[tIdx].followers.push(fId);
                
                // Add Notification
                if (!users[tIdx].notifications) users[tIdx].notifications = [];
                const notification = {
                    id: Date.now(),
                    type: 'follow',
                    message: `${users[fIdx].fullName} seni takip etmeye başladı.`,
                    fromId: fId,
                    createdAt: new Date().toISOString(),
                    read: false
                };
                users[tIdx].notifications.unshift(notification);
                
                // Log Activity
                if (!users[fIdx].activities) users[fIdx].activities = [];
                users[fIdx].activities.unshift({
                    id: Date.now() + 1,
                    type: 'follow',
                    content: `${users[tIdx].fullName} kullanıcısını takip etmeye başladı.`,
                    createdAt: new Date().toISOString()
                });

                localStorage.setItem('forum_users', JSON.stringify(users));
                
                // CRITICAL: Update current session immediately
                const session = ForumDB.getSession();
                if (session && Number(session.id) === fId) {
                    ForumDB.setSession(users[fIdx]);
                }
                return true;
            }
        }
        return false;
    },

    unfollowUser: (followerId, targetId) => {
        const fId = Number(followerId);
        const tId = Number(targetId);
        const users = ForumDB.getUsers();
        const fIdx = users.findIndex(u => Number(u.id) === fId);
        const tIdx = users.findIndex(u => Number(u.id) === tId);

        if (fIdx !== -1 && tIdx !== -1) {
            users[fIdx].following = (users[fIdx].following || []).filter(id => Number(id) !== tId);
            users[tIdx].followers = (users[tIdx].followers || []).filter(id => Number(id) !== fId);
            
            localStorage.setItem('forum_users', JSON.stringify(users));
            
            const session = ForumDB.getSession();
            if (session && Number(session.id) === fId) {
                ForumDB.setSession(users[fIdx]);
            }
            return true;
        }
        return false;
    },

    logActivity: (userId, type, content) => {
        const users = ForumDB.getUsers();
        const index = users.findIndex(u => Number(u.id) === Number(userId));
        if (index !== -1) {
            if (!users[index].activities) users[index].activities = [];
            users[index].activities.unshift({
                id: Date.now(),
                type,
                content,
                createdAt: new Date().toISOString()
            });
            localStorage.setItem('forum_users', JSON.stringify(users));
            return true;
        }
        return false;
    },

    getFollowSuggestions: (userId) => {
        const users = ForumDB.getUsers();
        const currentUser = users.find(u => Number(u.id) === Number(userId));
        if (!currentUser) return [];
        
        const currentInterests = (currentUser.interests || '').toLowerCase().split(',').map(i => i.trim());
        const currentCommittees = currentUser.committees || [];

        return users
            .filter(u => Number(u.id) !== Number(userId) && !currentUser.following.includes(u.id))
            .map(u => {
                let score = 0;
                let reasons = [];

                // Check Shared Committees
                const sharedCommittees = (u.committees || []).filter(c => currentCommittees.includes(c));
                if (sharedCommittees.length > 0) {
                    score += sharedCommittees.length * 10;
                    reasons.push('Aynı Komite');
                }

                // Check Shared Interests
                const userInterests = (u.interests || '').toLowerCase().split(',').map(i => i.trim());
                const sharedInterests = userInterests.filter(i => i && currentInterests.includes(i));
                if (sharedInterests.length > 0) {
                    score += sharedInterests.length * 5;
                    reasons.push('Benzer İlgi Alanı');
                }

                // New user boost
                const isNew = (new Date() - new Date(u.joinedAt)) < (1000 * 60 * 60 * 24 * 7); // Joined in last 7 days
                if (isNew) score += 2;

                return { ...u, suggestionScore: score, suggestionReason: reasons[0] || 'Aktif Üye' };
            })
            .sort((a, b) => b.suggestionScore - a.suggestionScore)
            .slice(0, 5);
    },

    login: (identifier, password) => {
        const users = ForumDB.getUsers();
        const raw = (identifier || '').toString().trim();
        if (!raw) return null;
        const normalized = raw.toLowerCase();

        // 1) Username ile giriş (öncelikli)
        let user = users.find(u => (u.username || '').toString().toLowerCase() === normalized);

        // 2) Email ile giriş
        if (!user) {
            user = users.find(u => (u.email || '').toString().toLowerCase() === normalized);
        }

        if (!user || user.password !== password) return null;

        if (ForumDB.isUserBanned(user.id)) {
            if (typeof ForumUI !== 'undefined') {
                ForumUI.notify('Hesabınız geçici olarak kısıtlanmıştır.', 'error');
            }
            return null;
        }

        // Login history kaydı
        const historyEntry = {
            id: Date.now(),
            at: new Date().toISOString(),
            userAgent: (typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'),
            platform: (typeof navigator !== 'undefined' ? navigator.platform : 'unknown')
        };
        if (!Array.isArray(user.securityLoginHistory)) user.securityLoginHistory = [];
        user.securityLoginHistory.unshift(historyEntry);
        localStorage.setItem('forum_users', JSON.stringify(users));

        ForumDB.setSession(user);
        
        // XP: Daily Login
        const xpResult = ForumDB.addXP(user.id, 'daily_login');
        if (xpResult && xpResult.earnedPoints && typeof ForumUI !== 'undefined') {
            setTimeout(() => ForumUI.notifyXP(xpResult.earnedPoints, 'Günlük Giriş', xpResult.leveledUp, xpResult.newTitle), 1000);
        }
        
        return user;
    },

    updateUserProfile: (userId, updateData) => {
        const users = ForumDB.getUsers();
        const index = users.findIndex(u => Number(u.id) === Number(userId));
        if (index !== -1) {
            users[index] = { ...users[index], ...updateData };
            localStorage.setItem('forum_users', JSON.stringify(users));
            
            const session = ForumDB.getSession();
            if (session && Number(session.id) === Number(userId)) {
                ForumDB.setSession(users[index]);
            }
            return true;
        }
        return false;
    },

    updateUsername: (userId, newUsername) => {
        const users = ForumDB.getUsers();
        const idx = users.findIndex(u => Number(u.id) === Number(userId));
        if (idx === -1) return { ok: false, error: 'Kullanıcı bulunamadı.' };

        const raw = (newUsername || '').toString().trim();
        if (!raw) {
            return { ok: false, error: 'Kullanıcı adı boş olamaz.' };
        }
        if (!/^[A-Za-z0-9]{3,}$/.test(raw)) {
            return { ok: false, error: 'Kullanıcı adı en az 3 karakter olmalı ve sadece harf/sayı içermelidir.' };
        }

        const lower = raw.toLowerCase();
        const taken = users.some(u => Number(u.id) !== Number(userId) && (u.username || '').toString().toLowerCase() === lower);
        if (taken) {
            return { ok: false, error: 'Bu kullanıcı adı başka bir kullanıcı tarafından kullanılıyor.' };
        }

        users[idx].username = raw;
        localStorage.setItem('forum_users', JSON.stringify(users));

        const session = ForumDB.getSession();
        if (session && Number(session.id) === Number(userId)) {
            ForumDB.setSession(users[idx]);
        }

        return { ok: true, user: users[idx] };
    },

    assignCommitteeHead: (userId, committeeId) => {
        const users = ForumDB.getUsers();
        // First, remove previous head of this committee
        users.forEach(u => {
            if (u.leadOf === committeeId) {
                u.leadOf = null;
                u.role = u.committees.length > 0 ? 'committee_member' : 'member';
            }
        });

        const index = users.findIndex(u => Number(u.id) === Number(userId));
        if (index !== -1) {
            users[index].role = 'committee_head';
            users[index].leadOf = committeeId;
            if (!users[index].committees.includes(committeeId)) {
                users[index].committees.push(committeeId);
            }
            localStorage.setItem('forum_users', JSON.stringify(users));
            
            const session = ForumDB.getSession();
            if (session && Number(session.id) === Number(userId)) ForumDB.setSession(users[index]);

            // Governance transparency log
            try {
                const actor = ForumDB.getSession();
                const committeesMap = { bilim: 'Bilim Komitesi', teknoloji: 'Teknoloji Komitesi', sanat: 'Sanat Komitesi', sosyal: 'Sosyal Sorumluluk', organizasyon: 'Organizasyon' };
                const committeeLabel = committeesMap[committeeId] || committeeId || 'Komite';
                ForumDB.logGovernanceActivity({
                    type: 'komite_baskani_atama',
                    title: `${committeeLabel} için yeni komite başkanı atandı`,
                    description: `${users[index].fullName} komite başkanı olarak görevlendirildi.` + (actor ? ` İşlem: ${actor.fullName}.` : '')
                });
            } catch (e) {}
            return true;
        }
        return false;
    },

    leaveCommittee: (userId, committeeId) => {
        const users = ForumDB.getUsers();
        const idx = users.findIndex(u => Number(u.id) === Number(userId));
        if (idx === -1) return false;
        const user = users[idx];
        user.committees = (user.committees || []).filter(c => c !== committeeId);
        if (user.leadOf === committeeId) {
            user.leadOf = null;
            user.role = user.committees.length > 0 ? 'committee_member' : 'member';
        }
        localStorage.setItem('forum_users', JSON.stringify(users));

        const session = ForumDB.getSession();
        if (session && Number(session.id) === Number(userId)) {
            ForumDB.setSession(user);
        }

        // Governance transparency log
        try {
            const committeesMap = { bilim: 'Bilim Komitesi', teknoloji: 'Teknoloji Komitesi', sanat: 'Sanat Komitesi', sosyal: 'Sosyal Sorumluluk', organizasyon: 'Organizasyon' };
            const committeeLabel = committeesMap[committeeId] || committeeId || 'Komite';
            ForumDB.logGovernanceActivity({
                type: 'komiteden_ayrilma',
                title: `${user.fullName} ${committeeLabel} komitesinden ayrıldı`,
                description: ''
            });
        } catch (e) {}
        return true;
    },

    // --- Yönetim Kurulu RBAC yardımcıları ---
    isPresident: (user) => user && user.governanceRole === 'president',
    isVicePresident: (user) => user && user.governanceRole === 'vp',
    isSchoolPresident: (user) => user && user.governanceRole === 'school_president',
    isGovernanceMember: (user) => user && user.governanceRole && user.governanceRole !== 'none',

    canManageUsers: (user) => {
        if (!user) return false;
        if (user.role === 'admin') return true;
        return ForumDB.isPresident(user) || ForumDB.isVicePresident(user);
    },
    canBanUsers: (user) => {
        if (!user) return false;
        // Sadece site admini ve Oluşum Başkanı
        return user.role === 'admin' || ForumDB.isPresident(user);
    },
    canManageCommittees: (user) => {
        if (!user) return false;
        if (user.role === 'admin') return true;
        return ForumDB.isPresident(user) || ForumDB.isVicePresident(user);
    },
    canApproveProjects: (user) => {
        if (!user) return false;
        if (user.role === 'admin') return true;
        return ForumDB.isPresident(user) || ForumDB.isVicePresident(user) || user.role === 'committee_head';
    },

    // --- Applications ---
    getApplications: () => JSON.parse(localStorage.getItem('forum_apps')) || [],
    submitApplication: (appData) => {
        const apps = ForumDB.getApplications();
        const newApp = {
            id: Date.now(),
            status: 'pending',
            submittedAt: new Date().toISOString(),
            ...appData
        };
        apps.push(newApp);
        localStorage.setItem('forum_apps', JSON.stringify(apps));
        return newApp;
    },
    getUserApplications: (userId) => ForumDB.getApplications().filter(app => app.userId === userId),
    updateApplicationStatus: (appId, status) => {
        const apps = ForumDB.getApplications();
        const index = apps.findIndex(a => Number(a.id) === Number(appId));
        if (index !== -1) {
            apps[index].status = status;
            localStorage.setItem('forum_apps', JSON.stringify(apps));
            
            if (status === 'accepted') {
                const users = ForumDB.getUsers();
                const userIndex = users.findIndex(u => Number(u.id) === Number(apps[index].userId));
                if (userIndex !== -1) {
                    if (!users[userIndex].committees) users[userIndex].committees = [];
                    if (!users[userIndex].committees.includes(apps[index].committeeId)) {
                        users[userIndex].committees.push(apps[index].committeeId);
                        // Update role to committee_member only if not head or admin
                        if (users[userIndex].role === 'member') {
                            users[userIndex].role = 'committee_member';
                        }
                        
                        if (!users[userIndex].badges.includes('committee_member')) {
                            users[userIndex].badges.push('committee_member');
                        }
                    }
                    localStorage.setItem('forum_users', JSON.stringify(users));
                    const session = ForumDB.getSession();
                    if (session && Number(session.id) === Number(users[userIndex].id)) ForumDB.setSession(users[userIndex]);
                }
            }
            // Governance transparency log
            const actor = ForumDB.getSession();
            const committeesMap = { bilim: 'Bilim Komitesi', teknoloji: 'Teknoloji Komitesi', sanat: 'Sanat Komitesi', sosyal: 'Sosyal Sorumluluk', organizasyon: 'Organizasyon' };
            const committeeLabel = committeesMap[apps[index].committeeId] || apps[index].committeeId || 'Komite';
            const applicantName = apps[index].userName || `Kullanıcı #${apps[index].userId}`;
            try {
                ForumDB.logGovernanceActivity({
                    type: status === 'accepted' ? 'başvuru_onay' : 'başvuru_red',
                    title: `${committeeLabel} için üyelik başvurusu ${status === 'accepted' ? 'onaylandı' : 'reddedildi'}`,
                    description: `${applicantName} adlı kullanıcının başvurusu ${status === 'accepted' ? 'kabul edildi' : 'reddedildi'}.` + (actor ? ` İşlem: ${actor.fullName}.` : '')
                });
            } catch (e) {}
            return true;
        }
        return false;
    },

    // --- Projects (Points 2, 3, 9) ---
    getProjects: () => {
        let projects;
        try {
            projects = JSON.parse(localStorage.getItem('forum_projects')) || [];
        } catch (e) {
            projects = [];
            localStorage.removeItem('forum_projects');
        }
        if (!Array.isArray(projects)) projects = [];
        const users = ForumDB.getUsers();
        const arr = (v) => (Array.isArray(v) ? v : []);
        const normalizeProject = (p) => {
            const proj = p && typeof p === 'object' ? p : {};
            const creatorId = proj.creatorId != null ? Number(proj.creatorId) : (proj.ownerId != null ? Number(proj.ownerId) : null);
            const creator = users.find(u => Number(u.id) === Number(creatorId));
            const inferredCategory =
                proj.category ||
                proj.committee ||
                proj.committeeId ||
                (creator && (creator.leadOf || (Array.isArray(creator.committees) && creator.committees[0]))) ||
                '';
            const status = (proj.status === 'active' || proj.status === 'pending') ? proj.status : 'active';
            return {
                ...proj,
                id: proj.id ?? Date.now(),
                status,
                category: inferredCategory,
                creatorId,
                members: arr(proj.members).map(Number).filter(n => Number.isFinite(n)),
                requests: arr(proj.requests).map(r => ({
                    ...(r && typeof r === 'object' ? r : {}),
                    id: (r && r.id) ?? Date.now(),
                    userId: Number(r && r.userId),
                    userName: (r && r.userName) || '',
                    message: (r && r.message) || '',
                    role: (r && r.role) || '',
                    status: (r && (r.status === 'pending' || r.status === 'approved' || r.status === 'rejected')) ? r.status : 'pending',
                    createdAt: (r && r.createdAt) || new Date().toISOString()
                })),
                tasks: arr(proj.tasks),
                files: arr(proj.files),
                timeline: arr(proj.timeline),
                createdAt: proj.createdAt || new Date().toISOString()
            };
        };

        const normalized = projects.map(normalizeProject);
        const changed = JSON.stringify(projects) !== JSON.stringify(normalized);
        projects = normalized;
        if (changed) {
            localStorage.setItem('forum_projects', JSON.stringify(projects));
        }
        return projects;
    },
    createProject: (projectData) => {
        const projects = ForumDB.getProjects();
        const creatorId = Number(projectData.creatorId);
        const session = ForumDB.getSession();
        const resolvedCategory =
            projectData.category ||
            (session?.role === 'committee_head' ? (session.leadOf || session.committees?.[0] || '') : '') ||
            '';
        
        // Auto-approve if created by admin or committee head of that committee
        const isAutoApproved = session && (session.role === 'admin' || (session.role === 'committee_head' && (session.leadOf || session.committees?.[0]) === resolvedCategory));
        
        const newProject = {
            id: Date.now(),
            status: isAutoApproved ? 'active' : 'pending',
            members: [creatorId],
            requests: [],
            tasks: [], // Added for Project Management
            timeline: [
                { stage: 'fikir', label: 'Fikir Aşaması', status: 'completed', date: new Date().toISOString() },
                { stage: 'planlama', label: 'Planlama', status: 'current', date: null },
                { stage: 'gelistirme', label: 'Geliştirme', status: 'pending', date: null },
                { stage: 'test', label: 'Test', status: 'pending', date: null },
                { stage: 'tamamlanma', label: 'Tamamlanma', status: 'pending', date: null }
            ],
            files: [], // Added for File Sharing
            createdAt: new Date().toISOString(),
            ...projectData,
            category: resolvedCategory,
            creatorId: creatorId
        };
        projects.push(newProject);
        localStorage.setItem('forum_projects', JSON.stringify(projects));
        
        // XP: Project Start (60 XP) - Only if auto-approved, or wait for approval? 
        // Let's give XP only when approved to prevent spam.
        if (isAutoApproved) {
            const xpResult = ForumDB.addXP(creatorId, 'project_create');
            if (xpResult && xpResult.earnedPoints && typeof ForumUI !== 'undefined') {
                ForumUI.notifyXP(xpResult.earnedPoints, 'Yeni Proje Başlatma', xpResult.leveledUp, xpResult.newTitle);
            }
        } else {
            // Notification to committee head about new project proposal
            const users = ForumDB.getUsers();
            const head = users.find(u => u.role === 'committee_head' && u.leadOf === projectData.category);
            if (head) {
                if (!head.notifications) head.notifications = [];
                head.notifications.unshift({
                    id: Date.now(),
                    type: 'project_proposal',
                    message: `${session.fullName}, ${projectData.category.toUpperCase()} komitesinde yeni bir proje önerdi.`,
                    projectId: newProject.id,
                    createdAt: new Date().toISOString(),
                    read: false
                });
                localStorage.setItem('forum_users', JSON.stringify(users));
            }
        }

        // Governance transparency log
        try {
            const actor = ForumDB.getSession();
            const committeesMap = { bilim: 'Bilim Komitesi', teknoloji: 'Teknoloji Komitesi', sanat: 'Sanat Komitesi', sosyal: 'Sosyal Sorumluluk', organizasyon: 'Organizasyon' };
            const committeeLabel = committeesMap[newProject.category] || newProject.category || 'Komite';
            ForumDB.logGovernanceActivity({
                type: isAutoApproved ? 'proje_olusturma' : 'proje_oneri',
                title: `"${newProject.title}" adlı proje ${committeeLabel} içinde ${isAutoApproved ? 'aktif edildi' : 'öneri olarak kaydedildi'}`,
                description: actor ? `İşlem: ${actor.fullName}.` : ''
            });
        } catch (e) {}

        // Add Badge for first project (only if active)
        if (isAutoApproved) {
            const users = ForumDB.getUsers();
            const userIndex = users.findIndex(u => Number(u.id) === creatorId);
            if (userIndex !== -1) {
                if (!users[userIndex].badges) users[userIndex].badges = [];
                if (!users[userIndex].badges.includes('project_leader')) {
                    users[userIndex].badges.push('project_leader');
                    localStorage.setItem('forum_users', JSON.stringify(users));
                    
                    if (session && Number(session.id) === creatorId) {
                        session.badges = users[userIndex].badges;
                        ForumDB.setSession(session);
                    }
                }
            }
        }
        return newProject;
    },
    approveProject: (projectId) => {
        const projects = ForumDB.getProjects();
        const index = projects.findIndex(p => Number(p.id) === Number(projectId));
        if (index !== -1) {
            projects[index].status = 'active';
            localStorage.setItem('forum_projects', JSON.stringify(projects));
            
            const creatorId = projects[index].creatorId;
            
            // Notification to creator
            const users = ForumDB.getUsers();
            const userIdx = users.findIndex(u => Number(u.id) === Number(creatorId));
            if (userIdx !== -1) {
                if (!users[userIdx].notifications) users[userIdx].notifications = [];
                users[userIdx].notifications.unshift({
                    id: Date.now(),
                    type: 'project_approved',
                    message: `"${projects[index].title}" başlıklı proje önerin onaylandı ve yayına alındı!`,
                    projectId: Number(projectId),
                    createdAt: new Date().toISOString(),
                    read: false
                });
                
                // Give XP now
                ForumDB.addXP(creatorId, 'project_create');
                
                // Add Badge if needed
                if (!users[userIdx].badges) users[userIdx].badges = [];
                if (!users[userIdx].badges.includes('project_leader')) {
                    users[userIdx].badges.push('project_leader');
                }
                
                localStorage.setItem('forum_users', JSON.stringify(users));
            }
            return true;
        }
        return false;
    },
    rejectProject: (projectId) => {
        const projects = ForumDB.getProjects();
        const index = projects.findIndex(p => Number(p.id) === Number(projectId));
        if (index !== -1) {
            const creatorId = projects[index].creatorId;
            const title = projects[index].title;
            
            // Move to trash or just delete? Let's move to trash
            const trash = JSON.parse(localStorage.getItem('forum_trash')) || [];
            trash.push({ ...projects[index], deletedAt: new Date().toISOString(), type: 'project', status: 'rejected' });
            localStorage.setItem('forum_trash', JSON.stringify(trash));
            
            const filtered = projects.filter(p => Number(p.id) !== Number(projectId));
            localStorage.setItem('forum_projects', JSON.stringify(filtered));
            
            // Notification to creator
            const users = ForumDB.getUsers();
            const userIdx = users.findIndex(u => Number(u.id) === Number(creatorId));
            if (userIdx !== -1) {
                if (!users[userIdx].notifications) users[userIdx].notifications = [];
                users[userIdx].notifications.unshift({
                    id: Date.now(),
                    type: 'project_rejected',
                    message: `"${title}" başlıklı proje önerin uygun görülmedi.`,
                    createdAt: new Date().toISOString(),
                    read: false
                });
                localStorage.setItem('forum_users', JSON.stringify(users));
            }
            return true;
        }
        return false;
    },
    updateProjectDetails: (projectId, updateData) => {
        const projects = ForumDB.getProjects();
        const index = projects.findIndex(p => Number(p.id) === Number(projectId));
        if (index !== -1) {
            projects[index] = { ...projects[index], ...updateData };
            localStorage.setItem('forum_projects', JSON.stringify(projects));
            return true;
        }
        return false;
    },
    addProjectTask: (projectId, taskData) => {
        const projects = ForumDB.getProjects();
        const index = projects.findIndex(p => Number(p.id) === Number(projectId));
        if (index !== -1) {
            const newTask = {
                id: Date.now(),
                status: 'yapılacak', // yapılacak, yapılıyor, tamamlandı
                createdAt: new Date().toISOString(),
                ...taskData
            };
            if (!projects[index].tasks) projects[index].tasks = [];
            projects[index].tasks.push(newTask);
            localStorage.setItem('forum_projects', JSON.stringify(projects));
            return newTask;
        }
        return null;
    },
    updateProjectTaskStatus: (projectId, taskId, status) => {
        const projects = ForumDB.getProjects();
        const pIdx = projects.findIndex(p => Number(p.id) === Number(projectId));
        if (pIdx !== -1) {
            const tIdx = projects[pIdx].tasks.findIndex(t => Number(t.id) === Number(taskId));
            if (tIdx !== -1) {
                projects[pIdx].tasks[tIdx].status = status;
                localStorage.setItem('forum_projects', JSON.stringify(projects));
                return true;
            }
        }
        return false;
    },
    addProjectFile: (projectId, fileData) => {
        const projects = ForumDB.getProjects();
        const index = projects.findIndex(p => Number(p.id) === Number(projectId));
        if (index !== -1) {
            const newFile = {
                id: Date.now(),
                uploadedAt: new Date().toISOString(),
                ...fileData
            };
            if (!projects[index].files) projects[index].files = [];
            projects[index].files.push(newFile);
            localStorage.setItem('forum_projects', JSON.stringify(projects));
            return newFile;
        }
        return null;
    },
    joinProjectRequest: (projectId, userId, userName, message, role) => {
        const projects = ForumDB.getProjects();
        const pIndex = projects.findIndex(p => Number(p.id) === Number(projectId));
        if (pIndex === -1) return false;

        const project = projects[pIndex];

        // Permission guard: only members of the committee (or admin) may request
        const users = ForumDB.getUsers();
        const requester = users.find(u => Number(u.id) === Number(userId));
        if (!requester) return false;
        const isAdmin = requester.role === 'admin';
        const isInCommittee = requester.committees?.includes(project.category);
        if (!isAdmin && !isInCommittee) {
            return false;
        }

        if (!project.requests) project.requests = [];
        if (project.requests.find(r => Number(r.userId) === Number(userId))) {
            return false;
        }

        const request = {
            id: Date.now(),
            userId: Number(userId),
            userName,
            message,
            role,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        project.requests.push(request);
        localStorage.setItem('forum_projects', JSON.stringify(projects));
        
        // Notifications
        const updatedUsers = ForumDB.getUsers();

        // 1) Project leader
        const leaderIdx = updatedUsers.findIndex(u => Number(u.id) === Number(project.creatorId));
        if (leaderIdx !== -1) {
            if (!updatedUsers[leaderIdx].notifications) updatedUsers[leaderIdx].notifications = [];
            updatedUsers[leaderIdx].notifications.unshift({
                id: Date.now() + 1,
                type: 'project_request',
                message: `${userName}, "${project.title}" projesine katılmak istiyor.`,
                fromId: Number(userId),
                projectId: Number(projectId),
                createdAt: new Date().toISOString(),
                read: false
            });
        }

        // 2) Committee head (if exists) for this project's committee
        const headIdx = updatedUsers.findIndex(u => u.role === 'committee_head' && u.leadOf === project.category);
        if (headIdx !== -1) {
            if (!updatedUsers[headIdx].notifications) updatedUsers[headIdx].notifications = [];
            updatedUsers[headIdx].notifications.unshift({
                id: Date.now() + 2,
                type: 'project_request',
                message: `${userName}, "${project.title}" projesine katılmak istiyor.`,
                fromId: Number(userId),
                projectId: Number(projectId),
                createdAt: new Date().toISOString(),
                read: false
            });
        }

        localStorage.setItem('forum_users', JSON.stringify(updatedUsers));
        return true;
    },
    approveProjectRequest: (projectId, userId) => {
        const projects = ForumDB.getProjects();
        const index = projects.findIndex(p => Number(p.id) === Number(projectId));
        if (index !== -1) {
            const reqIndex = projects[index].requests.findIndex(r => Number(r.userId) === Number(userId));
            if (reqIndex !== -1) {
                projects[index].requests[reqIndex].status = 'approved';
                if (!projects[index].members.includes(Number(userId))) {
                    projects[index].members.push(Number(userId));
                }
                localStorage.setItem('forum_projects', JSON.stringify(projects));
                
                // Notification to user
                const users = ForumDB.getUsers();
                const userIdx = users.findIndex(u => Number(u.id) === Number(userId));
                if (userIdx !== -1) {
                    if (!users[userIdx].notifications) users[userIdx].notifications = [];
                    users[userIdx].notifications.unshift({
                        id: Date.now() + 2,
                        type: 'project_approved',
                        message: `"${projects[index].title}" projesine katılım isteğin kabul edildi!`,
                        projectId: Number(projectId),
                        createdAt: new Date().toISOString(),
                        read: false
                    });
                    
                    if (!users[userIdx].projects) users[userIdx].projects = [];
                    if (!users[userIdx].projects.includes(Number(projectId))) {
                        users[userIdx].projects.push(Number(projectId));
                    }
                    localStorage.setItem('forum_users', JSON.stringify(users));
                    
                    // Update session if needed
                    const session = ForumDB.getSession();
                    if (session && Number(session.id) === Number(userId)) ForumDB.setSession(users[userIdx]);
                }

                // XP: Project Participation (40 XP)
                const xpResult = ForumDB.addXP(userId, 'project_join');
                if (xpResult && xpResult.earnedPoints && typeof ForumUI !== 'undefined') {
                    ForumUI.notifyXP(xpResult.earnedPoints, 'Projeye Katılım', xpResult.leveledUp, xpResult.newTitle);
                }
                return true;
            }
        }
        return false;
    },
    rejectProjectRequest: (projectId, userId) => {
        const projects = ForumDB.getProjects();
        const index = projects.findIndex(p => Number(p.id) === Number(projectId));
        if (index !== -1) {
            const reqIndex = projects[index].requests.findIndex(r => Number(r.userId) === Number(userId));
            if (reqIndex !== -1) {
                projects[index].requests[reqIndex].status = 'rejected';
                localStorage.setItem('forum_projects', JSON.stringify(projects));
                
                // Notification to user
                const users = ForumDB.getUsers();
                const userIdx = users.findIndex(u => Number(u.id) === Number(userId));
                if (userIdx !== -1) {
                    if (!users[userIdx].notifications) users[userIdx].notifications = [];
                    users[userIdx].notifications.unshift({
                        id: Date.now() + 3,
                        type: 'project_rejected',
                        message: `"${projects[index].title}" projesine katılım isteğin reddedildi.`,
                        projectId: Number(projectId),
                        createdAt: new Date().toISOString(),
                        read: false
                    });
                    localStorage.setItem('forum_users', JSON.stringify(users));
                }
                return true;
            }
        }
        return false;
    },
    deleteProject: (projectId) => {
        const id = Number(projectId);
        const projects = ForumDB.getProjects();
        const projectToDelete = projects.find(p => Number(p.id) === id);
        
        if (projectToDelete) {
            // Move to trash
            const trash = JSON.parse(localStorage.getItem('forum_trash')) || [];
            trash.push({ ...projectToDelete, deletedAt: new Date().toISOString(), type: 'project' });
            localStorage.setItem('forum_trash', JSON.stringify(trash));
            
            // Remove from projects
            const filtered = projects.filter(p => Number(p.id) !== id);
            localStorage.setItem('forum_projects', JSON.stringify(filtered));
            
            // Also remove from users' project lists
            const users = ForumDB.getUsers();
            users.forEach(u => {
                if (u.projects) u.projects = u.projects.filter(pid => Number(pid) !== id);
            });
            localStorage.setItem('forum_users', JSON.stringify(users));
            return true;
        }
        return false;
    },

    // --- Tasks (Point 6, 7) ---
    getTasks: () => JSON.parse(localStorage.getItem('forum_tasks')) || [],
    createTask: (taskData) => {
        const tasks = ForumDB.getTasks();
        const newTask = {
            id: Date.now(),
            status: 'todo', // todo, in_progress, completed
            createdAt: new Date().toISOString(),
            ...taskData
        };
        tasks.push(newTask);
        localStorage.setItem('forum_tasks', JSON.stringify(tasks));
        return newTask;
    },
    updateTaskStatus: (taskId, status) => {
        const id = Number(taskId);
        const tasks = ForumDB.getTasks();
        const index = tasks.findIndex(t => Number(t.id) === id);
        if (index !== -1) {
            const oldStatus = tasks[index].status;
            tasks[index].status = status;
            localStorage.setItem('forum_tasks', JSON.stringify(tasks));

            // XP: Task Completion (25 XP)
            if (status === 'completed' && oldStatus !== 'completed') {
                const xpResult = ForumDB.addXP(tasks[index].assigneeId, 'task_complete');
                if (xpResult && xpResult.earnedPoints && typeof ForumUI !== 'undefined') {
                    ForumUI.notifyXP(xpResult.earnedPoints, 'Görev Tamamlama', xpResult.leveledUp, xpResult.newTitle);
                }
            }
            return true;
        }
        return false;
    },
    deleteTask: (taskId) => {
        const id = Number(taskId);
        const tasks = ForumDB.getTasks();
        const taskToDelete = tasks.find(t => Number(t.id) === id);
        if (taskToDelete) {
            // Move to trash
            const trash = JSON.parse(localStorage.getItem('forum_trash')) || [];
            trash.push({ ...taskToDelete, deletedAt: new Date().toISOString(), type: 'task' });
            localStorage.setItem('forum_trash', JSON.stringify(trash));
            
            // Remove from tasks
            const filtered = tasks.filter(t => Number(t.id) !== id);
            localStorage.setItem('forum_tasks', JSON.stringify(filtered));
            return true;
        }
        return false;
    },

    // --- Trash System ---
    getTrash: () => JSON.parse(localStorage.getItem('forum_trash')) || [],
    restoreFromTrash: (itemId) => {
        const id = Number(itemId);
        const trash = ForumDB.getTrash();
        const index = trash.findIndex(item => Number(item.id) === id);
        if (index !== -1) {
            const item = trash[index];
            const type = item.type;
            delete item.type;
            delete item.deletedAt;
            
            if (type === 'project') {
                const projects = ForumDB.getProjects();
                projects.push(item);
                localStorage.setItem('forum_projects', JSON.stringify(projects));
            } else if (type === 'task') {
                const tasks = ForumDB.getTasks();
                tasks.push(item);
                localStorage.setItem('forum_tasks', JSON.stringify(tasks));
            }
            
            const newTrash = trash.filter(i => Number(i.id) !== id);
            localStorage.setItem('forum_trash', JSON.stringify(newTrash));
            return true;
        }
        return false;
    },
    permanentlyDelete: (itemId) => {
        const id = Number(itemId);
        const trash = ForumDB.getTrash();
        const newTrash = trash.filter(i => Number(i.id) !== id);
        localStorage.setItem('forum_trash', JSON.stringify(newTrash));
        return true;
    },

    // --- Ideas & Fikir Panosu (Point 5) ---
    getIdeas: () => {
        let ideas;
        try {
            ideas = JSON.parse(localStorage.getItem('forum_ideas')) || [];
        } catch (e) {
            ideas = [];
            localStorage.removeItem('forum_ideas');
        }
        if (!Array.isArray(ideas)) ideas = [];
        const normalize = (i) => {
            const idea = i && typeof i === 'object' ? i : {};
            const voters = Array.isArray(idea.voters) ? idea.voters : [];
            const upVotes = typeof idea.upVotes === 'number' ? idea.upVotes : voters.filter(v => v.value === 1).length;
            const downVotes = typeof idea.downVotes === 'number' ? idea.downVotes : voters.filter(v => v.value === -1).length;
            return {
                id: idea.id || Date.now(),
                title: idea.title || '',
                content: idea.content || '',
                category: idea.category || 'general',
                userId: Number(idea.userId) || 0,
                userName: idea.userName || 'Üye',
                createdAt: idea.createdAt || new Date().toISOString(),
                status: idea.status || 'open',
                upVotes,
                downVotes,
                voters,
                comments: Array.isArray(idea.comments) ? idea.comments : [],
                isFeaturedWeek: !!idea.isFeaturedWeek,
                convertedToProjectId: idea.convertedToProjectId || null
            };
        };
        const normalized = ideas.map(normalize);
        if (JSON.stringify(ideas) !== JSON.stringify(normalized)) {
            localStorage.setItem('forum_ideas', JSON.stringify(normalized));
        }
        return normalized;
    },

    getTrendingIdeas: (limit = 5) => {
        return ForumDB.getIdeas()
            .filter(i => i.status === 'open')
            .sort((a, b) => ((b.upVotes || 0) - (b.downVotes || 0)) - ((a.upVotes || 0) - (a.downVotes || 0)))
            .slice(0, limit);
    },

    getIdeaOfTheWeek: () => {
        const ideas = ForumDB.getIdeas();
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const recent = ideas.filter(i => new Date(i.createdAt) >= sevenDaysAgo && i.status === 'open');
        if (recent.length === 0) return null;
        return recent.sort((a, b) => ((b.upVotes || 0) - (b.downVotes || 0)) - ((a.upVotes || 0) - (a.downVotes || 0)))[0];
    },
    createIdea: (ideaData) => {
        const ideas = ForumDB.getIdeas();
        const newIdea = {
            id: Date.now(),
            comments: [],
            voters: [],
            upVotes: 0,
            downVotes: 0,
            createdAt: new Date().toISOString(),
            status: 'open',
            isFeaturedWeek: false,
            convertedToProjectId: null,
            ...ideaData
        };
        ideas.push(newIdea);
        localStorage.setItem('forum_ideas', JSON.stringify(ideas));
        
        // XP: Idea Share (15 XP)
        const xpResult = ForumDB.addXP(ideaData.userId, 'idea_share');
        if (xpResult && xpResult.earnedPoints && typeof ForumUI !== 'undefined') {
            ForumUI.notifyXP(xpResult.earnedPoints, 'Fikir Paylaşma', xpResult.leveledUp, xpResult.newTitle);
        }

        // Log Activity
        ForumDB.logActivity(ideaData.userId, 'idea', `"${ideaData.title}" başlıklı bir fikir paylaştı.`);
        
        return newIdea;
    },
    voteIdea: (ideaId, userId, value) => {
        const ideas = ForumDB.getIdeas();
        const index = ideas.findIndex(i => Number(i.id) === Number(ideaId));
        if (index === -1) return null;
        const idea = ideas[index];
        const v = Math.sign(value) === -1 ? -1 : 1;
        if (!Array.isArray(idea.voters)) idea.voters = [];
        let up = idea.upVotes || 0;
        let down = idea.downVotes || 0;

        const existing = idea.voters.find(vt => Number(vt.userId) === Number(userId));
        if (!existing) {
            idea.voters.push({ userId: Number(userId), value: v });
            if (v === 1) up++; else down++;
        } else if (existing.value === v) {
            // Same vote again -> no-op
        } else {
            // Switch vote
            if (existing.value === 1) { up--; down++; }
            else { down--; up++; }
            existing.value = v;
        }

        idea.upVotes = up;
        idea.downVotes = down;
        ideas[index] = idea;
        localStorage.setItem('forum_ideas', JSON.stringify(ideas));
        return { upVotes: up, downVotes: down, value: v };
    },
    addIdeaComment: (ideaId, commentData) => {
        const ideas = ForumDB.getIdeas();
        const index = ideas.findIndex(i => Number(i.id) === Number(ideaId));
        if (index !== -1) {
            if (!ideas[index].comments) ideas[index].comments = [];
            const newComment = {
                id: Date.now(),
                ...commentData,
                createdAt: new Date().toISOString()
            };
            ideas[index].comments.push(newComment);
            localStorage.setItem('forum_ideas', JSON.stringify(ideas));

            // XP: Comment Write (5 XP)
            const xpResult = ForumDB.addXP(commentData.userId, 'comment_write');
            if (xpResult && xpResult.earnedPoints && typeof ForumUI !== 'undefined') {
                ForumUI.notifyXP(xpResult.earnedPoints, 'Yorum Yazma', xpResult.leveledUp, xpResult.newTitle);
            }
            return newComment;
        }
        return null;
    },

    convertIdeaToProject: (ideaId, committeeId, creatorId) => {
        const ideas = ForumDB.getIdeas();
        const idx = ideas.findIndex(i => Number(i.id) === Number(ideaId));
        if (idx === -1) return null;
        const idea = ideas[idx];
        if (idea.convertedToProjectId) return null;

        const creator = ForumDB.getUsers().find(u => Number(u.id) === Number(creatorId));
        const project = ForumDB.createProject({
            title: idea.title,
            description: idea.content,
            category: committeeId,
            creatorId: creatorId,
            creatorName: creator?.fullName || 'Yönetici',
            needs: 'Fikirden projeye dönüştürüldü'
        });

        idea.status = 'accepted';
        idea.convertedToProjectId = project.id;
        ideas[idx] = idea;
        localStorage.setItem('forum_ideas', JSON.stringify(ideas));

        // Reward idea owner
        const users = ForumDB.getUsers();
        const ownerIdx = users.findIndex(u => Number(u.id) === Number(idea.userId));
        if (ownerIdx !== -1) {
            if (!users[ownerIdx].badges) users[ownerIdx].badges = [];
            if (!users[ownerIdx].badges.includes('idea_accepted')) {
                users[ownerIdx].badges.push('idea_accepted');
            }
            if (!users[ownerIdx].notifications) users[ownerIdx].notifications = [];
            users[ownerIdx].notifications.unshift({
                id: Date.now(),
                type: 'idea_accepted',
                message: `"${idea.title}" başlıklı fikrin bir projeye dönüştürüldü!`,
                createdAt: new Date().toISOString(),
                read: false
            });
            localStorage.setItem('forum_users', JSON.stringify(users));
        }

        // Governance transparency log
        try {
            ForumDB.logGovernanceActivity({
                type: 'fikir_proje_donusum',
                title: `"${idea.title}" fikri projeye dönüştürüldü`,
                description: `Oluşturulan proje ID: ${project.id}.`
            });
        } catch (e) {}

        return project;
    },

    // --- Events & Calendar (Point 4, 10) ---
    getEvents: () => JSON.parse(localStorage.getItem('forum_events')) || [],
    createEvent: (eventData) => {
        const events = ForumDB.getEvents();
        const newEvent = {
            id: Date.now(),
            gallery: [],
            createdAt: new Date().toISOString(),
            ...eventData
        };
        events.push(newEvent);
        localStorage.setItem('forum_events', JSON.stringify(events));

        // XP: Event Organize (80 XP)
        const xpResult = ForumDB.addXP(eventData.organizerId || eventData.userId, 'event_organize');
        if (xpResult && xpResult.earnedPoints && typeof ForumUI !== 'undefined') {
            ForumUI.notifyXP(xpResult.earnedPoints, 'Etkinlik Düzenleme', xpResult.leveledUp, xpResult.newTitle);
        }

        return newEvent;
    },

    // --- Announcements (Point 12) ---
    getAnnouncements: () => JSON.parse(localStorage.getItem('forum_announcements')) || [
        { id: 1, title: 'Yeni Dönem Başvuruları', content: '2024-2025 eğitim dönemi komite başvuruları açıldı!', type: 'info', date: new Date().toISOString() },
        { id: 2, title: 'Genel Kurul Toplantısı', content: 'Tüm üyelerimizin katılımıyla genel kurul toplantısı yapılacaktır.', type: 'warning', date: new Date().toISOString() }
    ],
    createAnnouncement: (data) => {
        const ann = JSON.parse(localStorage.getItem('forum_announcements')) || ForumDB.getAnnouncements();
        ann.unshift({ id: Date.now(), ...data, date: new Date().toISOString() });
        localStorage.setItem('forum_announcements', JSON.stringify(ann));
    },

    // --- Yönetim Duyuruları ---
    getGovernanceAnnouncements: () => {
        try {
            const list = JSON.parse(localStorage.getItem('forum_governance_announcements')) || [];
            return Array.isArray(list) ? list : [];
        } catch (e) {
            localStorage.removeItem('forum_governance_announcements');
            return [];
        }
    },
    createGovernanceAnnouncement: ({ title, content, category }) => {
        const session = ForumDB.getSession();
        if (!session) return { ok: false, error: 'Giriş yapmalısın.' };
        if (!ForumDB.isGovernanceMember(session) && session.role !== 'admin') {
            return { ok: false, error: 'Bu işlem için yetkin yok.' };
        }

        const list = ForumDB.getGovernanceAnnouncements();
        const item = {
            id: Date.now(),
            authorId: Number(session.id),
            authorName: session.fullName,
            title: (title || '').trim(),
            content: (content || '').trim(),
            category: (category || 'genel').trim(),
            createdAt: new Date().toISOString()
        };
        if (!item.title || !item.content) {
            return { ok: false, error: 'Başlık ve içerik zorunlu.' };
        }
        list.unshift(item);
        localStorage.setItem('forum_governance_announcements', JSON.stringify(list));

        // Basit bildirim: tüm kullanıcılara yönetim duyurusu
        const users = ForumDB.getUsers();
        const note = {
            id: Date.now(),
            type: 'governance_announcement',
            message: `Yönetim duyurusu: ${item.title}`,
            createdAt: new Date().toISOString(),
            read: false
        };
        users.forEach(u => {
            if (!u.notifications) u.notifications = [];
            u.notifications.unshift({ ...note });
        });
        localStorage.setItem('forum_users', JSON.stringify(users));

        // Governance transparency log
        try {
            ForumDB.logGovernanceActivity({
                type: 'yonetim_duyuru',
                title: `Yönetim duyurusu: ${item.title}`,
                description: item.content.slice(0, 140)
            });
        } catch (e) {}

        return { ok: true, announcement: item };
    },

    // --- Stats & Featured (Point 11, 13, 14) ---
    getStats: () => {
        const users = ForumDB.getUsers();
        const projects = ForumDB.getProjects();
        const events = ForumDB.getEvents();
        const tasks = ForumDB.getTasks();
        
        return {
            members: users.length,
            committees: 5,
            projects: projects.length,
            events: events.length,
            tasks: tasks.length
        };
    },
    getCommitteeStats: (committeeId) => {
        const users = ForumDB.getUsers();
        const projects = ForumDB.getProjects();
        const events = ForumDB.getEvents();
        
        return {
            members: users.filter(u => u.committees?.includes(committeeId)).length,
            projects: projects.filter(p => p.category === committeeId).length,
            events: events.filter(e => e.committee === committeeId).length
        };
    },

    // --- Yönetim Mesajları ---
    getGovernanceMessages: () => {
        try {
            const list = JSON.parse(localStorage.getItem('forum_governance_messages')) || [];
            return Array.isArray(list) ? list : [];
        } catch (e) {
            localStorage.removeItem('forum_governance_messages');
            return [];
        }
    },
    createGovernanceMessage: ({ fromUserId, type, subject, content }) => {
        const users = ForumDB.getUsers();
        const sender = users.find(u => u.id === fromUserId);
        if (!sender) return { ok: false, error: 'Kullanıcı bulunamadı.' };

        const list = ForumDB.getGovernanceMessages();
        const msg = {
            id: Date.now(),
            fromUserId,
            fromName: sender.fullName,
            fromUsername: sender.username || '',
            type: (type || 'diger').trim(),
            subject: (subject || '').trim(),
            content: (content || '').trim(),
            status: 'open', // open | in_progress | resolved
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        if (!msg.subject || !msg.content) {
            return { ok: false, error: 'Konu ve mesaj zorunlu.' };
        }
        list.unshift(msg);
        localStorage.setItem('forum_governance_messages', JSON.stringify(list));

        // Basit bildirim: yönetime yeni mesaj
        const governors = users.filter(u => ForumDB.isGovernanceMember(u) || u.role === 'admin');
        const note = {
            id: Date.now(),
            type: 'governance_message',
            message: `${sender.fullName} yönetim kuruluna yeni bir mesaj gönderdi.`,
            createdAt: new Date().toISOString(),
            read: false
        };
        governors.forEach(u => {
            if (!u.notifications) u.notifications = [];
            u.notifications.unshift({ ...note });
        });
        localStorage.setItem('forum_users', JSON.stringify(users));

        return { ok: true, message: msg };
    },
    updateGovernanceMessageStatus: (id, status) => {
        const session = ForumDB.getSession();
        if (!session || (!ForumDB.isGovernanceMember(session) && session.role !== 'admin')) {
            return { ok: false, error: 'Bu işlem için yetkin yok.' };
        }
        const list = ForumDB.getGovernanceMessages();
        const idx = list.findIndex(m => m.id === id);
        if (idx === -1) return { ok: false, error: 'Mesaj bulunamadı.' };
        list[idx].status = status;
        list[idx].updatedAt = new Date().toISOString();
        localStorage.setItem('forum_governance_messages', JSON.stringify(list));
        return { ok: true, message: list[idx] };
    },

    // --- Yönetim Oylamaları / Anketleri ---
    getGovernancePolls: () => {
        try {
            const raw = JSON.parse(localStorage.getItem('forum_governance_polls')) || [];
            if (!Array.isArray(raw)) return [];
            return raw.map(p => ({
                id: Number(p.id) || Date.now(),
                question: p.question || '',
                options: Array.isArray(p.options) ? p.options.map((o, idx) => ({
                    id: Number(o.id ?? idx + 1),
                    text: (o.text || '').trim(),
                    votes: Number(o.votes) || 0
                })) : [],
                createdBy: Number(p.createdBy) || 0,
                createdByName: p.createdByName || '',
                createdAt: p.createdAt || new Date().toISOString(),
                closesAt: p.closesAt || null,
                scope: p.scope || 'all', // all | members | governance
                voters: Array.isArray(p.voters) ? p.voters : [] // { userId, optionId }
            }));
        } catch (e) {
            localStorage.removeItem('forum_governance_polls');
            return [];
        }
    },
    createGovernancePoll: ({ question, options, scope, closesAt }) => {
        const session = ForumDB.getSession();
        if (!session) return { ok: false, error: 'Giriş yapmalısın.' };
        if (!ForumDB.isGovernanceMember(session) && session.role !== 'admin') {
            return { ok: false, error: 'Bu işlem için yetkin yok.' };
        }
        const q = (question || '').trim();
        const opts = Array.isArray(options) ? options.map(o => (o || '').trim()).filter(Boolean) : [];
        if (!q || opts.length < 2) {
            return { ok: false, error: 'En az 2 seçenekli bir soru girmelisin.' };
        }
        const polls = ForumDB.getGovernancePolls();
        const pollId = Date.now();
        const poll = {
            id: pollId,
            question: q,
            options: opts.map((text, idx) => ({ id: idx + 1, text, votes: 0 })),
            createdBy: Number(session.id),
            createdByName: session.fullName,
            createdAt: new Date().toISOString(),
            closesAt: closesAt || null,
            scope: scope || 'all',
            voters: []
        };
        polls.unshift(poll);
        localStorage.setItem('forum_governance_polls', JSON.stringify(polls));
        try {
            ForumDB.logGovernanceActivity({
                type: 'anket',
                title: `Yönetim anketi: ${poll.question}`,
                description: `Kapsam: ${poll.scope}. Seçenek sayısı: ${poll.options.length}.`
            });
        } catch (e) {}
        return { ok: true, poll };
    },
    voteGovernancePoll: ({ pollId, optionId, userId }) => {
        const polls = ForumDB.getGovernancePolls();
        const idx = polls.findIndex(p => Number(p.id) === Number(pollId));
        if (idx === -1) return { ok: false, error: 'Anket bulunamadı.' };
        const poll = polls[idx];
        const now = new Date();
        if (poll.closesAt && new Date(poll.closesAt) < now) {
            return { ok: false, error: 'Bu anket sona erdi.' };
        }
        const optIdx = poll.options.findIndex(o => Number(o.id) === Number(optionId));
        if (optIdx === -1) return { ok: false, error: 'Seçenek bulunamadı.' };

        if (!Array.isArray(poll.voters)) poll.voters = [];
        // Kullanıcı daha önce oy vermiş mi?
        const existing = poll.voters.find(v => Number(v.userId) === Number(userId));
        if (existing) {
            if (Number(existing.optionId) === Number(optionId)) {
                return { ok: true, poll }; // aynı seçeneğe tekrar basma -> no-op
            }
            // Eski seçenekten bir oy eksilt
            const prevIdx = poll.options.findIndex(o => Number(o.id) === Number(existing.optionId));
            if (prevIdx !== -1 && poll.options[prevIdx].votes > 0) {
                poll.options[prevIdx].votes -= 1;
            }
            existing.optionId = Number(optionId);
        } else {
            poll.voters.push({ userId: Number(userId), optionId: Number(optionId) });
        }
        // Yeni seçeneğe oy ekle
        poll.options[optIdx].votes += 1;
        polls[idx] = poll;
        localStorage.setItem('forum_governance_polls', JSON.stringify(polls));
        try {
            ForumDB.logGovernanceActivity({
                type: 'anket_oy',
                title: `Ankete yeni oy: ${poll.question}`,
                description: `Kullanıcı #${userId} oy kullandı.`
            });
        } catch (e) {}
        return { ok: true, poll };
    },

    // --- Yönetim Şeffaflık / Faaliyet Logları ---
    getGovernanceActivities: () => {
        try {
            const list = JSON.parse(localStorage.getItem('forum_governance_activities')) || [];
            return Array.isArray(list) ? list : [];
        } catch (e) {
            localStorage.removeItem('forum_governance_activities');
            return [];
        }
    },
    logGovernanceActivity: ({ type, title, description }) => {
        const session = ForumDB.getSession();
        const list = ForumDB.getGovernanceActivities();
        const item = {
            id: Date.now(),
            type: type || 'genel', // proje, başvuru, güncelleme vb.
            title: (title || '').trim(),
            description: (description || '').trim(),
            createdAt: new Date().toISOString(),
            actorId: session?.id || null,
            actorName: session?.fullName || null
        };
        list.unshift(item);
        localStorage.setItem('forum_governance_activities', JSON.stringify(list));
        return item;
    },
    getFeaturedMember: () => {
        const users = ForumDB.getUsers();
        // Return admin or a random active user for simulation
        return users.find(u => u.role === 'admin') || users[0];
    },
    getSponsors: () => [
        { id: 1, name: 'Gençlik Vakfı', logo: 'GV' },
        { id: 2, name: 'Teknoloji Derneği', logo: 'TD' },
        { id: 3, name: 'Kültür Sanat Vakfı', logo: 'KSV' }
    ],
    getBadgesInfo: () => {
        const base = {
            'new_member': { label: 'Yeni Üye', icon: 'user' },
            'committee_member': { label: 'Komite Üyesi', icon: 'shield' },
            'project_leader': { label: 'Proje Lideri', icon: 'rocket' },
            'admin': { label: 'Yönetici', icon: 'shield-check' },
            'founder': { label: 'Kurucu', icon: 'award' },
            'streak_7': { label: '7 Günlük Seri', icon: 'flame' },
            'streak_30': { label: '30 Günlük Seri', icon: 'flame' },
            'streak_60_premium': { label: '60 Günlük Premium Seri', icon: 'flame' },
            'streak_100_legend': { label: 'Efsanevi Üye', icon: 'flame' },
            'idea_accepted': { label: 'Fikir Ustası', icon: 'lightbulb' }
        };
        const custom = {};
        ForumDB.getCustomBadges().forEach(b => {
            custom[b.key] = { label: b.name, icon: 'star' };
        });
        return { ...base, ...custom };
    }
};

// Navbar dynamic update
document.addEventListener('DOMContentLoaded', () => {
    ForumDB.getUsers();
    const session = ForumDB.getSession();
    const navRight = document.getElementById('navbar-auth-links'); 
    const mobileMenu = document.getElementById('mobile-menu');
    const isRoot = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/') || !window.location.pathname.includes('/pages/');
    const pathPrefix = isRoot ? 'pages/' : '';

    if (session) {
        if (navRight) {
            navRight.innerHTML = `
                <div class="flex items-center space-x-6">
                    <a href="${pathPrefix}dashboard.html" class="text-xs font-black uppercase tracking-widest hover:text-accent transition">Panel</a>
                    <button onclick="ForumDB.logout()" class="bg-black text-white px-5 py-2.5 rounded-md hover:bg-accent transition text-[10px] font-black uppercase tracking-widest">Çıkış</button>
                </div>
            `;
            navRight.classList.remove('hidden');
        }
        if (mobileMenu) {
            let joinBtn = mobileMenu.querySelector('a[href*="basvuru.html"], a[href*="register.html"]');
            if (joinBtn) {
                joinBtn.href = pathPrefix + 'dashboard.html';
                joinBtn.textContent = 'Panelim';
                if (!mobileMenu.querySelector('button[onclick*="logout"]')) {
                    const logoutBtn = document.createElement('button');
                    logoutBtn.onclick = () => ForumDB.logout();
                    logoutBtn.className = "block w-full bg-red-600 text-white text-center px-5 py-2.5 rounded-md font-bold uppercase mt-2";
                    logoutBtn.textContent = "Çıkış Yap";
                    mobileMenu.appendChild(logoutBtn);
                }
            }
        }
    } else {
        if (navRight) navRight.classList.remove('hidden');
    }
});
