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
                activities: arr(user.activities)
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
        const newUser = { 
            id: Date.now(), 
            ...userData, 
            role: 'member',
            xp: 0,
            level: 1,
            xpHistory: [],
            committees: [], 
            projects: [],
            badges: ['new_member'],
            followers: [], // Added for Follow System
            following: [], // Added for Follow System
            notifications: [], // Added for Notifications
            activities: [], // Added for Activity Feed
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

    login: (email, password) => {
        const users = ForumDB.getUsers();
        const user = users.find(u => u.email === email && u.password === password);
        if (user) {
            ForumDB.setSession(user);
            
            // XP: Daily Login
            const xpResult = ForumDB.addXP(user.id, 'daily_login');
            if (xpResult && xpResult.earnedPoints && typeof ForumUI !== 'undefined') {
                setTimeout(() => ForumUI.notifyXP(xpResult.earnedPoints, 'Günlük Giriş', xpResult.leveledUp, xpResult.newTitle), 1000);
            }
            
            return user;
        }
        return null;
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
            return true;
        }
        return false;
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

    // --- Ideas & Forum (Point 5) ---
    getIdeas: () => JSON.parse(localStorage.getItem('forum_ideas')) || [],
    createIdea: (ideaData) => {
        const ideas = ForumDB.getIdeas();
        const newIdea = {
            id: Date.now(),
            comments: [],
            likes: [],
            createdAt: new Date().toISOString(),
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
    toggleIdeaLike: (ideaId, userId) => {
        const ideas = ForumDB.getIdeas();
        const index = ideas.findIndex(i => Number(i.id) === Number(ideaId));
        if (index !== -1) {
            if (!ideas[index].likes) ideas[index].likes = [];
            const userIdx = ideas[index].likes.indexOf(Number(userId));
            if (userIdx === -1) {
                ideas[index].likes.push(Number(userId));
            } else {
                ideas[index].likes.splice(userIdx, 1);
            }
            localStorage.setItem('forum_ideas', JSON.stringify(ideas));
            return ideas[index].likes;
        }
        return null;
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
            'founder': { label: 'Kurucu', icon: 'award' }
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
