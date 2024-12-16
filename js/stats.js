class PlayerStats {
    constructor() {
        // 初始化 Supabase 客户端
        const { createClient } = supabase;
        this.supabaseClient = createClient(
            'https://obidukxlcgecpooynqnz.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iaWR1a3hsY2dlY3Bvb3lucW56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQyNjAyMDgsImV4cCI6MjA0OTgzNjIwOH0.a4Y-nWWxb8ClbMO2BUXG2vTJMqTJe2rQAXdWyKHZlHs'
        );
        this.currentBoard = 'attendance';
        this.currentType = 'total';
        this.init();
    }

    async init() {
        try {
            console.log('开始初始化...');
            await this.loadStats();
            this.renderBoards();
            this.renderTabs();
            this.renderPlayerList();
            this.bindEvents();
            console.log('初始化完成');
        } catch (error) {
            console.error('初始化失败:', error);
        }
    }

    async loadStats() {
        try {
            console.log('开始加载数据...');
            
            // 检查 supabaseClient 是否正确初始化
            if (!this.supabaseClient) {
                throw new Error('Supabase 客户端未初始化');
            }

            // 从 player_stats_2024 表加载数据
            const { data, error } = await this.supabaseClient
                .from('player_stats_2024')  // 使用正确的表名
                .select(`
                    id,
                    player_name,
                    attendance_total,
                    attendance_internal,
                    attendance_external,
                    goals_total,
                    goals_internal,
                    goals_external,
                    assists_total,
                    assists_internal,
                    assists_external
                `)
                .order('player_name');

            // 检查错误
            if (error) {
                console.error('数据库查询错误:', error);
                throw error;
            }

            // 检查数据
            if (!data) {
                console.warn('未收到数据');
                this.players = [];
                return;
            }

            console.log('成功加载数据:', data);
            this.players = data;

            // 检查数据格式
            if (this.players.length > 0) {
                console.log('示例数据:', this.players[0]);
            }

        } catch (error) {
            console.error('加载统计数据失败:', error);
            this.players = [];
            // 显示错误信息
            const container = document.querySelector('.stats-content');
            if (container) {
                container.innerHTML = `
                    <div class="error-message" style="color: red; padding: 1rem;">
                        加载数据失败: ${error.message}
                    </div>
                `;
            }
        }
    }

    // 获取当前显示的数值
    getPlayerValue(player) {
        const field = `${this.currentBoard}_${this.currentType}`;
        return player[field] || 0;
    }

    // 渲染榜单选择
    renderBoards() {
        const boardsHtml = `
            <div class="stats-boards">
                <button class="board-btn active" data-board="attendance">出勤榜</button>
                <button class="board-btn" data-board="goals">射手榜</button>
                <button class="board-btn" data-board="assists">助攻榜</button>
            </div>
        `;
        document.querySelector('.stats-content').insertAdjacentHTML('beforebegin', boardsHtml);
    }

    // 渲染标签页
    renderTabs() {
        const tabsHtml = `
            <div class="stats-tabs">
                <button class="tab-btn active" data-tab="total">总榜</button>
                <button class="tab-btn" data-tab="internal">内战</button>
                <button class="tab-btn" data-tab="external">外战</button>
            </div>
        `;
        document.querySelector('.stats-content').insertAdjacentHTML('beforebegin', tabsHtml);
    }

    // 渲染球员列表
    renderPlayerList() {
        const container = document.querySelector('.stats-content');
        
        if (!this.players || this.players.length === 0) {
            container.innerHTML = '<div class="no-data">暂无统计数据</div>';
            return;
        }

        const sortedPlayers = [...this.players].sort((a, b) => {
            const valueA = this.getPlayerValue(a) || 0;
            const valueB = this.getPlayerValue(b) || 0;
            return valueB - valueA;
        });

        const html = `
            <div class="stats-table">
                <div class="table-header">
                    <div class="col">排名</div>
                    <div class="col">球员</div>
                    <div class="col">${this.getBoardTitle()}</div>
                </div>
                ${sortedPlayers.map((player, index) => `
                    <div class="player-row">
                        <div class="col">${index + 1}</div>
                        <div class="col">${player.player_name}</div>
                        <div class="col">${this.getPlayerValue(player)}</div>
                    </div>
                `).join('')}
            </div>
        `;
        container.innerHTML = html;
    }

    // 绑定事件
    bindEvents() {
        // 榜单切换
        document.querySelector('.stats-boards').addEventListener('click', (e) => {
            const btn = e.target.closest('.board-btn');
            if (btn) {
                document.querySelectorAll('.board-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentBoard = btn.dataset.board;
                this.renderPlayerList();
            }
        });

        // 类型切换
        document.querySelector('.stats-tabs').addEventListener('click', (e) => {
            const btn = e.target.closest('.tab-btn');
            if (btn) {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentType = btn.dataset.tab;
                this.renderPlayerList();
            }
        });
    }

    // 获取榜单标题
    getBoardTitle() {
        const titles = {
            attendance: '出勤次数',
            goals: '进球数',
            assists: '助攻数'
        };
        return titles[this.currentBoard];
    }
} 