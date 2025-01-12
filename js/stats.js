class PlayerStats {
    constructor() {
        // 初始化 Supabase 客户端
        const { createClient } = supabase;
        this.supabaseClient = createClient(
            'https://obidukxlcgecpooynqnz.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iaWR1a3hsY2dlY3Bvb3lucW56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQyNjAyMDgsImV4cCI6MjA0OTgzNjIwOH0.a4Y-nWWxb8ClbMO2BUXG2vTJMqTJe2rQAXdWyKHZlHs'
        );
        this.currentBoard = 'attendance';
        this.sortField = 'total';
        this.sortDirection = 'desc';
        this.init();
    }

    async init() {
        try {
            console.log('开始初始化...');
            await this.loadStats();
            this.renderBoards();
            this.renderPlayerList();
            this.bindEvents();
            console.log('初始化完成');
        } catch (error) {
            console.error('初始化失败:', error);
        }
    }

    async loadStats() {
        try {
            console.log('开始加载 2025 年数据...');
            
            // 检查 supabaseClient 是否正确初始化
            if (!this.supabaseClient) {
                throw new Error('Supabase 客户端未初始化');
            }

            const tableName = `player_stats_2025`;
            const { data, error } = await this.supabaseClient
                .from(tableName)
                .select(`
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
                console.error('数据库查询错误 (2025):', error);
                throw error;
            }

            // 检查数据
            if (!data) {
                console.warn('未收到 2025 年数据');
                this.players = [];
                return;
            }

            console.log('成功加载 2025 年数据:', data);
            this.players = data;

            // 检查数据格式
            if (this.players.length > 0) {
                console.log('示例数据:', this.players[0]);
            }

        } catch (error) {
            console.error('加载 2025 年数据失败:', error);
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

    // 渲染球员列表
    renderPlayerList() {
        const container = document.querySelector('.stats-content');
        
        if (!this.players || this.players.length === 0) {
            container.innerHTML = '<div class="no-data">暂无统计数据</div>';
            return;
        }

        // 根据当前排序字段和方向排序
        const sortedPlayers = [...this.players].sort((a, b) => {
            const fieldName = `${this.currentBoard}_${this.sortField}`;
            const valueA = a[fieldName] || 0;
            const valueB = b[fieldName] || 0;
            return this.sortDirection === 'desc' ? valueB - valueA : valueA - valueB;
        });

        const html = `
            <div class="stats-table">
                <div class="table-header">
                    <div class="col rank">排名</div>
                    <div class="col name">球员</div>
                    <div class="col value sorted ${this.sortField === 'total' ? this.sortDirection : ''}" 
                         data-sort="total">总数</div>
                    <div class="col value ${this.sortField === 'internal' ? 'sorted ' + this.sortDirection : ''}" 
                         data-sort="internal">内战</div>
                    <div class="col value ${this.sortField === 'external' ? 'sorted ' + this.sortDirection : ''}" 
                         data-sort="external">外战</div>
                </div>
                ${sortedPlayers.map((player, index) => `
                    <div class="player-row">
                        <div class="col rank">${index + 1}</div>
                        <div class="col name">${player.player_name}</div>
                        <div class="col value">${player[`${this.currentBoard}_total`] || 0}</div>
                        <div class="col value">${player[`${this.currentBoard}_internal`] || 0}</div>
                        <div class="col value">${player[`${this.currentBoard}_external`] || 0}</div>
                    </div>
                `).join('')}
            </div>
        `;
        container.innerHTML = html;

        // 绑定排序事件
        this.bindSortEvents();
    }

    // 新增：绑定排序事件
    bindSortEvents() {
        const headers = document.querySelectorAll('.table-header .col[data-sort]');
        headers.forEach(header => {
            header.addEventListener('click', () => {
                const sortField = header.dataset.sort;
                if (this.sortField === sortField) {
                    // 如果点击的是当前排序字段，切换排序方向
                    this.sortDirection = this.sortDirection === 'desc' ? 'asc' : 'desc';
                } else {
                    // 如果点击的是新字段，设置为降序
                    this.sortField = sortField;
                    this.sortDirection = 'desc';
                }
                this.renderPlayerList();
            });
        });
    }

    // 修改绑定事件方法
    bindEvents() {
        document.querySelector('.stats-boards').addEventListener('click', (e) => {
            const btn = e.target.closest('.board-btn');
            if (btn) {
                document.querySelectorAll('.board-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentBoard = btn.dataset.board;
                // 切换榜单时重置排序为总数降序
                this.sortField = 'total';
                this.sortDirection = 'desc';
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