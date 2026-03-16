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

document.addEventListener('DOMContentLoaded', () => {
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
