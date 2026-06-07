// IMPORTANT: Replace with your new deployment URL
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbxqQgYtQBJY3mcuXr6QpuOnLAVWTXTrHaeGqnQlR48yWAK1nnlEJ6Imwy7wf8rudmKW6Q/exec";

// Initialize Google Analytics if measurement ID is configured
function initializeGoogleAnalytics() {
    if (window.GA_MEASUREMENT_ID && window.GA_MEASUREMENT_ID !== 'G-XXXXXXXXXX') {
        // Load gtag.js script dynamically
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${window.GA_MEASUREMENT_ID}`;
        document.head.appendChild(script);

        // Initialize dataLayer and gtag
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        window.gtag = gtag;
        gtag('js', new Date());
        gtag('config', window.GA_MEASUREMENT_ID, {
            'anonymize_ip': true,
            'allow_google_signals': false
        });
    }
}

document.addEventListener('alpine:init', () => {
    Alpine.store('app', { pageTitle: 'Academic AI Prompts' });
    initializeGoogleAnalytics();
});

function promptApp() {
    return {
        // --- State ---
        lang: 'jp',
        isDark: false,
        currentRole: 'faculty',
        allPrompts: [],
        globalLikesMap: {},
        searchQuery: '',
        selectedCategory: '',
        selectedTags: [],
        sortByLikes: false,
        showToast: false,
        showDownloadMenu: false,
        showPromptModal: false,
        selectedPrompt: null,
        userLikes: [],
        charts: { left: null, right: null },
        charts: {},
        dataStore: { faculty: [], student: [], shared: [], request: [] },

        tabs: [
            { id: 'faculty', label_jp: '教職員向け', label_en: 'Faculty', icon: 'fa-solid fa-chalkboard-user' },
            { id: 'student', label_jp: '学生向け', label_en: 'Students', icon: 'fa-solid fa-graduation-cap' },
            { id: 'shared', label_jp: 'ユーザー共有', label_en: 'Shared', icon: 'fa-solid fa-users' },
            { id: 'request', label_jp: '要望リスト', label_en: 'Requests', icon: 'fa-solid fa-clipboard-question' }
        ],

        i18n: {
            jp: {
                totalEngagement: '全体のリアクション数',
                tabEngagement: 'このタブのいいね',
                analyticsTitle: 'データ分析 & ランキング',
                searchPlaceholder: 'キーワードで探す...',
                btnContributeShort: '投稿',
                btnRequestShort: '要望',
                copyBtn: 'コピー',
                copied: '完了しました！',
                noData: 'データが見つかりません',
                tagLabel: 'タグ',
                categoryLabel: 'カテゴリー',
                totalLabel: 'いいね',
                tabLabel: 'いいね',
                downloadLabel: 'プロンプトをダウンロード',
                downloadFaculty: '教職員向けデータ',
                downloadStudent: '学生向けデータ'
            },
            en: {
                totalEngagement: 'Total Engagement',
                tabEngagement: 'Tab Likes',
                analyticsTitle: 'Analytics & Ranking',
                searchPlaceholder: 'Search prompts...',
                btnContributeShort: 'Contribute',
                btnRequestShort: 'Request',
                copyBtn: 'Copy',
                copied: 'Done!',
                noData: 'No data found',
                categoryLabel: 'Category',
                totalLabel: 'Likes',
                tabLabel: 'Likes',
                downloadLabel: 'Download prompts',
                downloadFaculty: 'Faculty data',
                downloadStudent: 'Student data'
            }
        },

        // --- Core Functions ---
        async initApp() {
            if (localStorage.getItem('app_theme') === 'dark' || (!localStorage.getItem('app_theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                this.isDark = true;
                document.documentElement.classList.add('dark');
            }

            // Auto-detect browser language if not set
            if (!localStorage.getItem('app_lang')) {
                const browserLang = navigator.language || navigator.languages[0];
                // Set to 'en' if browser language is English, otherwise 'jp'
                this.lang = browserLang.toLowerCase().startsWith('en') ? 'en' : 'jp';
            } else {
                this.lang = localStorage.getItem('app_lang');
            }

            this.currentRole = localStorage.getItem('app_role') || 'faculty';
            this.userLikes = JSON.parse(localStorage.getItem('user_likes') || '[]');

            // Initial full data load
            await this.loadAllData();

            // Start polling for likes every 60 seconds
            setInterval(() => this.fetchGlobalLikes(), 60000);
        },

        async loadAllData() {
            console.log("Starting optimized data fetch...");

            // 1. Fetch Static Data (Faculty & Student)
            const fetchStatic = async (role) => {
                try {
                    const res = await fetch(`data/${role}_prompts.json`);
                    if (!res.ok) throw new Error(`Failed to load ${role} json`);
                    return await res.json();
                } catch (e) {
                    console.error(e);
                    return [];
                }
            };

            // 2. Fetch Dynamic Data (Shared, Request, Likes)
            const fetchDynamic = async () => {
                const url = `${GAS_API_URL}?action=getCommunity&t=${new Date().getTime()}`;
                try {
                    const res = await fetch(url);
                    if (!res.ok) throw new Error('GAS Fetch Failed');
                    return await res.json();
                } catch (e) {
                    console.error(e);
                    return { shared: [], request: [], likes: {} };
                }
            };

            // Execute in parallel
            const [facultyData, studentData, dynamicData] = await Promise.all([
                fetchStatic('faculty'),
                fetchStatic('student'),
                fetchDynamic()
            ]);

            // 3. Combine Data
            this.dataStore = {
                faculty: facultyData,
                student: studentData,
                shared: dynamicData.shared || [],
                request: dynamicData.request || []
            };
            this.globalLikesMap = dynamicData.likes || {};

            console.log("Data load complete:", this.dataStore);

            // Render current view
            console.log("Rendering data for role:", this.currentRole);
            this.renderData();
        },

        // Switch role now just updates view from local store
        async switchRole(role) {
            this.currentRole = role;
            this.selectedCategory = '';
            this.selectedTags = [];
            this.searchQuery = '';
            localStorage.setItem('app_role', role);
            this.renderData();
        },

        renderData() {
            // Get data from local store based on role
            let roleData = this.dataStore[this.currentRole] || [];

            // Process IDs if needed
            if (this.currentRole === 'faculty' || this.currentRole === 'student') {
                this.allPrompts = roleData.map(p => {
                    const pid = String(p.id);
                    const needsPrefix = !pid.includes('-');
                    return { ...p, id: needsPrefix ? `${this.currentRole}-${pid}` : pid };
                });
            } else {
                this.allPrompts = roleData;
            }

            this.applyLikes();
            this.$nextTick(() => this.updateCharts());
        },

        async fetchGlobalLikes() {
            if (!GAS_API_URL || GAS_API_URL.includes("XXXXXXXX")) return;
            try {
                const res = await fetch(`${GAS_API_URL}?action=getLikes&t=${new Date().getTime()}`);
                if (res.ok) {
                    this.globalLikesMap = await res.json();
                    this.applyLikes();
                    // Don't redraw charts on background poll to avoid jitter, unless critical?
                    // Let's just update likes count in UI naturally via reactivity
                }
            } catch (e) { console.warn('GAS Fetch Error'); }
        },

        applyLikes() {
            this.allPrompts = this.allPrompts.map(p => ({
                ...p,
                likes: this.globalLikesMap[p.id] || 0
            }));
        },

        // --- Logic ---
        async toggleLike(item) {
            const id = item.id;
            const isLiked = this.userLikes.includes(id);

            if (isLiked) {
                this.userLikes = this.userLikes.filter(i => i !== id);
                item.likes = Math.max(0, (item.likes || 0) - 1);
            } else {
                this.userLikes.push(id);
                item.likes = (item.likes || 0) + 1;

                if (GAS_API_URL && !GAS_API_URL.includes("XXXXXXXX")) {
                    fetch(`${GAS_API_URL}?action=addLike`, {
                        method: 'POST',
                        body: JSON.stringify({
                            id: id,
                            title: item.title_jp || item.request || 'Unknown',
                            source: this.currentRole
                        })
                    });
                }
            }
            this.globalLikesMap[id] = item.likes;
            localStorage.setItem('user_likes', JSON.stringify(this.userLikes));
            this.updateCharts();
        },

        isLiked(id) { return this.userLikes.includes(id); },

        get sortedPrompts() {
            let data = this.allPrompts.filter(p => {
                const pCat = p.category_en || p.category || '';
                if (this.selectedCategory && pCat !== this.selectedCategory) return false;

                if (this.selectedTags.length > 0) {
                    const pTags = this.getTags(p);
                    if (!this.selectedTags.every(t => pTags.includes(t))) return false;
                }

                if (this.searchQuery) {
                    const q = this.searchQuery.toLowerCase();
                    const target = [
                        p.title_jp, p.title_en, p.description_jp,
                        ...this.getTags(p), p.request
                    ].join(' ').toLowerCase();
                    if (!target.includes(q)) return false;
                }
                return true;
            });

            if (this.sortByLikes) data.sort((a, b) => (b.likes || 0) - (a.likes || 0));
            return data;
        },

        get globalLikesTotal() {
            return Object.values(this.globalLikesMap).reduce((a, b) => a + b, 0);
        },
        get tabLikesTotal() {
            return this.allPrompts.reduce((sum, p) => sum + (p.likes || 0), 0);
        },

        getTags(p) {
            // Handle cases where GAS returns a string instead of an array
            let raw = p.keywords || (this.lang === 'jp' ? p.tags_jp : p.tags_en);
            if (!raw) return [];
            if (Array.isArray(raw)) return raw;
            return String(raw).split(/[,、]/).map(s => s.trim()).filter(s => s);
        },

        get displayTags() {
            const s = new Set();
            this.sortedPrompts.forEach(p => this.getTags(p).forEach(t => s.add(t)));
            return Array.from(s).sort();
        },

        get uniqueCategories() {
            // Allow all roles to have categories
            const s = new Set(this.allPrompts.map(p => p.category_en || p.category));
            return Array.from(s).filter(c => c).map(c => {
                const def = this.categories[c];
                return { id: c, jp: def ? def.jp : c, en: def ? def.en : c };
            });
        },

        async switchRole(role) {
            this.currentRole = role;
            this.selectedCategory = '';
            this.selectedTags = [];
            this.searchQuery = '';
            localStorage.setItem('app_role', role);
            this.renderData();
        },

        toggleLang() {
            this.lang = this.lang === 'jp' ? 'en' : 'jp';
            localStorage.setItem('app_lang', this.lang);
            this.updateCharts();
        },

        toggleDark() {
            this.isDark = !this.isDark;
            localStorage.setItem('app_theme', this.isDark ? 'dark' : 'light');
            document.documentElement.classList.toggle('dark', this.isDark);
            this.updateCharts();
        },

        toggleTag(tag) {
            this.selectedTags = this.selectedTags.includes(tag) ? this.selectedTags.filter(t => t !== tag) : [...this.selectedTags, tag];
        },

        resetFilters() { this.searchQuery = ''; this.selectedCategory = ''; this.selectedTags = []; },

        copyPrompt(id) {
            const el = document.getElementById('p-' + id);
            if (el) {
                navigator.clipboard.writeText(el.value).then(() => {
                    this.showToast = true;
                    setTimeout(() => this.showToast = false, 2000);
                });
            }
        },

        shareSite() {
            if (navigator.share) navigator.share({ title: 'Academic AI Prompts', url: window.location.href });
            else { navigator.clipboard.writeText(window.location.href); this.showToast = true; }
        },

        async downloadPromptData(type) {
            const map = {
                faculty: {
                    url: 'https://raw.githubusercontent.com/OkinawaYT/academic-ai-prompts/refs/heads/main/data/faculty_prompts.json',
                    filename: 'faculty_prompts.json'
                },
                student: {
                    url: 'https://raw.githubusercontent.com/OkinawaYT/academic-ai-prompts/refs/heads/main/data/student_prompts.json',
                    filename: 'student_prompts.json'
                }
            };

            const target = map[type];
            if (!target) return;

            try {
                const res = await fetch(target.url, { cache: 'no-store' });
                if (!res.ok) throw new Error('Download failed');
                const blob = await res.blob();
                const objectUrl = URL.createObjectURL(blob);

                const link = document.createElement('a');
                link.href = objectUrl;
                link.download = target.filename;
                document.body.appendChild(link);
                link.click();
                link.remove();
                URL.revokeObjectURL(objectUrl);
            } catch (e) {
                console.warn(e);
                window.open(target.url, '_blank', 'noopener');
            }

            this.showDownloadMenu = false;
        },

        sharePrompt(item) {
            const title = this.lang === 'jp' ? (item.title_jp || item.request) : (item.title_en || item.request);
            const body = this.lang === 'jp' ? (item.prompt_jp || item.prompt) : (item.prompt_en || item.prompt);
            const text = `【${title}】\n${(body || '').substring(0, 100)}...\n\n#AcademicAIPrompts\n${window.location.href}`;

            if (navigator.share) navigator.share({ text });
            else { navigator.clipboard.writeText(text); this.showToast = true; }
        },

        getCategoryLabel(item) {
            const k = item.category_en || item.category;
            const def = this.categories[k];
            return def ? (this.lang === 'jp' ? def.jp : def.en) : k;
        },

        openPromptModal(item) {
            this.selectedPrompt = item;
            this.showPromptModal = true;
            document.body.style.overflow = 'hidden';
        },

        closePromptModal() {
            this.showPromptModal = false;
            this.selectedPrompt = null;
            document.body.style.overflow = '';
        },

        updateCharts() {
            // Clear existing charts
            if (this.charts) {
                Object.values(this.charts).forEach(c => c && c.destroy());
            }
            this.charts = {};

            const isDark = this.isDark;
            const textColor = isDark ? '#cbd5e1' : '#475569';
            const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#8AC926', '#1982C4'];

            const renderDoughnut = (id, label, dataMap) => {
                const ctx = document.getElementById(id);
                if (!ctx) return;
                this.charts[id] = new Chart(ctx, {
                    type: 'doughnut',
                    data: { labels: Object.keys(dataMap), datasets: [{ data: Object.values(dataMap), backgroundColor: colors, borderWidth: 0 }] },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'right', labels: { color: textColor, font: { size: 10 }, boxWidth: 10 } },
                            title: { display: true, text: label, color: textColor, font: { size: 12 } }
                        }
                    }
                });
            };

            const renderBar = (id, label, dataMap) => {
                const ctx = document.getElementById(id);
                if (!ctx) return;
                this.charts[id] = new Chart(ctx, {
                    type: 'bar',
                    data: { labels: Object.keys(dataMap), datasets: [{ label: 'Count', data: Object.values(dataMap), backgroundColor: colors, borderRadius: 4 }] },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        indexAxis: 'y',
                        plugins: {
                            legend: { display: false },
                            title: { display: true, text: label, color: textColor, font: { size: 14 } }
                        },
                        scales: {
                            x: { ticks: { color: textColor, stepSize: 1, precision: 0 } },
                            y: { ticks: { color: textColor, autoSkip: false } }
                        }
                    }
                });
            };

            // Prepare Data Helpers
            const countBy = (field) => {
                const data = {};
                this.allPrompts.forEach(p => {
                    let val = p[field] || 'Unknown';
                    // Category special handling
                    if (field === 'category' || field === 'category_en') {
                        val = this.getCategoryLabel(p);
                    }
                    data[val] = (data[val] || 0) + 1;
                });
                return data;
            };

            // Common Likes Data
            const rData = {};
            const rLabel = this.lang === 'jp' ? '人気ランキング (Top 5)' : 'Top 5 Liked';
            const sorted = [...this.allPrompts].sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 5);
            sorted.forEach(p => {
                const name = this.lang === 'jp' ? (p.title_jp || p.id) : (p.title_en || p.id);
                rData[name.length > 20 ? name.substring(0, 20) + '...' : name] = p.likes || 0;
            });

            // --- Render Logic ---
            if (['faculty', 'student'].includes(this.currentRole)) {
                // Standard View
                renderDoughnut('chartLeft', this.lang === 'jp' ? 'カテゴリ分布' : 'Categories', countBy('category'));
                renderBar('chartRight', rLabel, rData);
            } else {
                // Multi View (Shared / Request)
                // 1. Position
                renderDoughnut('chartPos', this.lang === 'jp' ? '役職・立場' : 'Position', countBy('position'));

                // 2. Target
                renderDoughnut('chartTarget', this.lang === 'jp' ? '対象者' : 'Target', countBy('target'));

                // 3. Category
                renderDoughnut('chartCat', this.lang === 'jp' ? 'カテゴリ' : 'Category', countBy('category'));

                // 4. Model (Shared Only)
                if (this.currentRole === 'shared') {
                    renderDoughnut('chartModel', this.lang === 'jp' ? 'AIモデル' : 'AI Model', countBy('model'));
                }

                // 5. Likes
                renderBar('chartLikesMulti', rLabel, rData);
            }
        },

        categories: {
            teaching: { jp: '授業・教育', en: 'Teaching' },
            support: { jp: '学生支援', en: 'Support' },
            research: { jp: '研究・学術', en: 'Research' },
            admin: { jp: '学内業務', en: 'Admin' },
            external: { jp: '対外連携', en: 'External' },
            global: { jp: 'グローバル', en: 'Global' },
            self: { jp: '自己管理', en: 'Self-Mgmt' },
            learning: { jp: '学習・授業', en: 'Learning' },
            career: { jp: '就活', en: 'Career' },
            life: { jp: '大学生活', en: 'Campus Life' },
            language: { jp: '語学', en: 'Language' },
            shared: { jp: '共有', en: 'Shared' },
            request: { jp: '要望', en: 'Request' }
        }
    }
}