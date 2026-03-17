// Forum Platform - Main UI Interactions
const ForumUI = {
    notify: (message, type = 'success', duration = 3000) => {
        const container = document.getElementById('notification-container') || (() => {
            const div = document.createElement('div');
            div.id = 'notification-container';
            div.className = 'fixed top-8 right-8 z-[9999] space-y-4 pointer-events-none';
            document.body.appendChild(div);
            return div;
        })();

        const notification = document.createElement('div');
        notification.className = `
            flex items-center space-x-4 p-5 rounded-2xl shadow-2xl border border-white/20 backdrop-blur-xl 
            transform transition-all duration-500 translate-x-full opacity-0 pointer-events-auto min-w-[320px]
            ${type === 'success' ? 'bg-black text-white' : 'bg-accent text-white'}
        `;
        
        const icon = type === 'success' ? 'check-circle' : 'alert-circle';
        notification.innerHTML = `
            <div class="p-2 bg-white/10 rounded-xl">
                <i data-lucide="${icon}" class="w-6 h-6"></i>
            </div>
            <div class="flex-1">
                <p class="text-xs font-black uppercase tracking-widest">${type === 'success' ? 'Başarılı' : 'Hata'}</p>
                <p class="text-sm font-medium opacity-90">${message}</p>
            </div>
            <div class="absolute bottom-0 left-0 h-1 bg-white/20 transition-all duration-[${duration}ms] ease-linear w-full" id="notif-progress"></div>
        `;

        container.appendChild(notification);
        if (typeof lucide !== 'undefined') lucide.createIcons({ props: { parent: notification } });

        // Trigger animation
        setTimeout(() => {
            notification.classList.remove('translate-x-full', 'opacity-0');
            notification.classList.add('translate-x-0', 'opacity-100');
        }, 10);

        // Progress bar animation
        const progress = notification.querySelector('#notif-progress');
        setTimeout(() => progress.style.width = '0%', 10);

        // Remove notification
        setTimeout(() => {
            notification.classList.add('translate-x-full', 'opacity-0');
            notification.classList.remove('translate-x-0', 'opacity-100');
            setTimeout(() => notification.remove(), 500);
        }, duration);
    },

    notifyXP: (points, label, leveledUp = false, newTitle = '') => {
        const container = document.getElementById('xp-notification-container') || (() => {
            const div = document.createElement('div');
            div.id = 'xp-notification-container';
            div.className = 'fixed bottom-8 left-8 z-[9999] space-y-4 pointer-events-none';
            document.body.appendChild(div);
            return div;
        })();

        const notification = document.createElement('div');
        notification.className = `
            flex items-center space-x-4 p-4 rounded-2xl shadow-2xl border border-white/10 backdrop-blur-2xl 
            transform transition-all duration-700 -translate-x-full opacity-0 pointer-events-auto bg-black/80
        `;
        
        notification.innerHTML = `
            <div class="relative">
                <div class="w-12 h-12 bg-accent rounded-full flex items-center justify-center shadow-lg shadow-accent/40 animate-pulse">
                    <span class="text-white font-black text-xs">+${points}</span>
                </div>
                <div class="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                    <i data-lucide="star" class="w-2.5 h-2.5 text-accent fill-accent"></i>
                </div>
            </div>
            <div>
                <p class="text-[10px] font-black uppercase tracking-widest text-accent">XP Kazandın!</p>
                <p class="text-sm font-bold text-white">${label}</p>
            </div>
        `;

        container.appendChild(notification);
        if (typeof lucide !== 'undefined') lucide.createIcons({ props: { parent: notification } });

        // Level Up specific animation
        if (leveledUp) {
            setTimeout(() => {
                ForumUI.notify(`TEBRİKLER! ${newTitle} seviyesine ulaştın!`, 'success', 5000);
            }, 1000);
        }

        setTimeout(() => {
            notification.classList.remove('-translate-x-full', 'opacity-0');
            notification.classList.add('translate-x-0', 'opacity-100');
        }, 100);

        setTimeout(() => {
            notification.classList.add('-translate-x-full', 'opacity-0');
            notification.classList.remove('translate-x-0', 'opacity-100');
            setTimeout(() => notification.remove(), 700);
        }, 4000);
    }
};

// --- Theme Manager (light / dark / red) ---
const ForumTheme = (() => {
    const STORAGE_KEY = 'forum_theme';
    const THEMES = ['light', 'dark', 'red'];

    function getTheme() {
        const t = (localStorage.getItem(STORAGE_KEY) || 'light').toString();
        return THEMES.includes(t) ? t : 'light';
    }

    function setTheme(theme) {
        const t = THEMES.includes(theme) ? theme : 'light';
        localStorage.setItem(STORAGE_KEY, t);
        applyTheme(t);
        updateToggleButtons(t);
    }

    function cycleTheme() {
        const current = getTheme();
        const idx = THEMES.indexOf(current);
        const next = THEMES[(idx + 1) % THEMES.length];
        setTheme(next);
    }

    function injectStylesOnce() {
        if (document.getElementById('forum-theme-styles')) return;
        const style = document.createElement('style');
        style.id = 'forum-theme-styles';
        style.textContent = `
            :root { --accent: #E31E24; }
            .text-accent { color: var(--accent) !important; }
            .bg-accent { background-color: var(--accent) !important; }
            .border-accent { border-color: var(--accent) !important; }

            html[data-theme="dark"] { color-scheme: dark; }
            html[data-theme="red"] { color-scheme: dark; }

            html[data-theme="dark"] body,
            html[data-theme="red"] body {
                background-color: #0b1220 !important;
            }

            html[data-theme="dark"] .bg-white,
            html[data-theme="red"] .bg-white {
                background-color: #0f172a !important;
            }
            html[data-theme="red"] .bg-white { background-color: #12070a !important; }

            html[data-theme="dark"] .bg-gray-50,
            html[data-theme="red"] .bg-gray-50 { background-color: #0b1220 !important; }

            html[data-theme="dark"] .text-gray-900,
            html[data-theme="red"] .text-gray-900 { color: #f8fafc !important; }
            html[data-theme="dark"] .text-gray-800,
            html[data-theme="red"] .text-gray-800 { color: #e2e8f0 !important; }
            html[data-theme="dark"] .text-gray-700,
            html[data-theme="red"] .text-gray-700 { color: #cbd5e1 !important; }
            html[data-theme="dark"] .text-gray-600,
            html[data-theme="red"] .text-gray-600 { color: #94a3b8 !important; }
            html[data-theme="dark"] .text-gray-500,
            html[data-theme="red"] .text-gray-500 { color: #94a3b8 !important; }
            html[data-theme="dark"] .text-gray-400,
            html[data-theme="red"] .text-gray-400 { color: #64748b !important; }

            html[data-theme="dark"] .border-gray-100,
            html[data-theme="dark"] .border-gray-200,
            html[data-theme="red"] .border-gray-100,
            html[data-theme="red"] .border-gray-200 {
                border-color: rgba(255,255,255,0.08) !important;
            }
            html[data-theme="dark"] .bg-black { background-color: #020617 !important; }
            html[data-theme="red"] .bg-black { background-color: #080205 !important; }

            html[data-theme="dark"] header.bg-white,
            html[data-theme="red"] header.bg-white { background-color: rgba(2,6,23,0.88) !important; backdrop-filter: blur(14px); }

            html[data-theme="dark"] .shadow-xl,
            html[data-theme="dark"] .shadow-2xl,
            html[data-theme="red"] .shadow-xl,
            html[data-theme="red"] .shadow-2xl { box-shadow: 0 20px 60px rgba(0,0,0,0.45) !important; }
        `;
        document.head.appendChild(style);
    }

    function applyTheme(theme) {
        injectStylesOnce();
        const root = document.documentElement;
        root.dataset.theme = theme;
        if (theme === 'red') root.style.setProperty('--accent', '#ff2a2a');
        else root.style.setProperty('--accent', '#E31E24');
    }

    function renderPill(el, theme) {
        const options = [
            { key: 'light', label: 'Açık', icon: 'sun' },
            { key: 'dark', label: 'Koyu', icon: 'moon' },
            { key: 'red', label: 'Kırmızı', icon: 'flame' }
        ];
        el.setAttribute('role', 'tablist');
        el.setAttribute('aria-label', 'Tema seçimi');
        el.innerHTML = `
            <div class="inline-flex items-center p-1 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-md shadow-sm">
                ${options.map(o => {
                    const active = o.key === theme;
                    return `
                        <button type="button"
                                data-theme-choice="${o.key}"
                                role="tab"
                                aria-selected="${active ? 'true' : 'false'}"
                                class="${active ? 'bg-black text-white shadow' : 'text-gray-600 hover:bg-gray-100'} inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition">
                            <i data-lucide="${o.icon}" class="w-4 h-4"></i>
                            <span class="hidden lg:inline">${o.label}</span>
                        </button>
                    `;
                }).join('')}
            </div>
        `;
        el.querySelectorAll('[data-theme-choice]').forEach(btn => {
            btn.addEventListener('click', () => setTheme(btn.getAttribute('data-theme-choice')));
        });
    }

    function updateToggleButtons(theme) {
        // Yeni premium pill
        document.querySelectorAll('[data-theme-toggle="pill"]').forEach(el => renderPill(el, theme));

        // Geriye uyumluluk: eski tek buton (varsa)
        document.querySelectorAll('[data-theme-toggle]:not([data-theme-toggle="pill"])').forEach(btn => {
            const label = theme === 'light' ? 'Açık' : (theme === 'dark' ? 'Koyu' : 'Kırmızı');
            const icon = theme === 'light' ? 'sun' : (theme === 'dark' ? 'moon' : 'flame');
            btn.setAttribute('aria-label', `Tema: ${label}`);
            btn.innerHTML = `<i data-lucide="${icon}" class="w-5 h-5"></i><span class="hidden sm:inline text-[10px] font-black uppercase tracking-widest">${label}</span>`;
            btn.onclick = cycleTheme;
        });

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function init() {
        const theme = getTheme();
        applyTheme(theme);
        updateToggleButtons(theme);
        // Pill toggle'lar render içinde bağlanıyor; tek butonlar burada
        document.querySelectorAll('[data-theme-toggle]:not([data-theme-toggle="pill"])').forEach(btn => {
            btn.addEventListener('click', cycleTheme);
        });
    }

    return { init, getTheme, setTheme, cycleTheme };
})();

document.addEventListener('DOMContentLoaded', () => {
    // Theme init
    try { ForumTheme.init(); } catch (e) {}

    // Initialize Lucide Icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    // Initialize AOS
    if (typeof AOS !== 'undefined') {
        AOS.init({
            duration: 800,
            easing: 'ease-in-out',
            once: true,
            mirror: false
        });
    }

    // Mobile Menu Toggle
    const menuBtn = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');

    if (menuBtn && mobileMenu) {
        menuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }
});
