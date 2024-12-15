class PlayerStats {
    constructor() {
        this.initializePlayersIfNeeded();
        this.players = this.loadPlayers();
        this.currentBoard = 'attendance'; // 当前显示的榜单：attendance/goals/assists
        this.currentType = 'total';       // 当前显示的类型：total/internal/external
        this.sortDirection = 'desc';      // 排序方向
        this.init();
    }

    // 初始化默认球员数据
    initializePlayersIfNeeded() {
        if (!localStorage.getItem('playerStats')) {
            const defaultPlayers = {
                mainPlayers: [
                    "霏赫", "阿曼", "嘉磊", "赵哥", "赵祺", "罗霄", "广文", "黄鹏", 
                    "马指", "邵林", "一陶", "尚枫", "朱门", "小鹤", "陈光", "井", 
                    "杨超", "金昊", "张健", "小常", "赵军", "扇子", "毛毛", "威威", 
                    "蔡湑", "袁祎", "李蒙", "宣宇", "康进", "旭东", "田爽", "贾楠", 
                    "麦克", "勋哥", "小杰", "马蒂", "肖凯"
                ].map(name => ({
                    name,
                    attendance: {
                        internal: 0,
                        external: 0
                    },
                    stats: {
                        internal: { goals: 0, assists: 0 },
                        external: { goals: 0, assists: 0 }
                    }
                }))
            };
            localStorage.setItem('playerStats', JSON.stringify(defaultPlayers));
        }
    }

    // 加载球员数据
    loadPlayers() {
        const storedPlayers = localStorage.getItem('playerStats');
        return storedPlayers ? JSON.parse(storedPlayers) : { mainPlayers: [] };
    }

    // 初始化
    init() {
        this.renderBoards();
        this.renderTabs();
        this.renderPlayerList();
        this.bindEvents();
    }

    // 渲染榜单选择
    renderBoards() {
        const boardsHtml = `
            <div class="stats-boards">
                <button class="board-btn active" data-board="attendance">
                    <span data-board="attendance">出勤榜</span>
                </button>
                <button class="board-btn" data-board="goals">
                    <span data-board="goals">射手榜</span>
                </button>
                <button class="board-btn" data-board="assists">
                    <span data-board="assists">助攻榜</span>
                </button>
            </div>
        `;
        document.querySelector('.stats-content').insertAdjacentHTML('beforebegin', boardsHtml);
    }

    // 渲染标签页
    renderTabs() {
        const tabsHtml = `
            <div class="stats-tabs">
                <button class="tab-btn active" data-tab="total">
                    <span data-tab="total">总榜</span>
                </button>
                <button class="tab-btn" data-tab="internal">
                    <span data-tab="internal">内战</span>
                </button>
                <button class="tab-btn" data-tab="external">
                    <span data-tab="external">外战</span>
                </button>
            </div>
        `;
        document.querySelector('.stats-content').insertAdjacentHTML('beforebegin', tabsHtml);
    }

    // 渲染球员列表
    renderPlayerList() {
        const container = document.querySelector('.stats-content');
        const boardTitle = this.getBoardTitle();
        
        const html = `
            <div class="stats-table">
                <div class="table-header">
                    <div class="col">排名</div>
                    <div class="col sortable" data-sort="name">
                        球员 ${this.getSortIcon('name')}
                    </div>
                    <div class="col sortable" data-sort="value">
                        ${boardTitle} ${this.getSortIcon('value')}
                    </div>
                </div>
                ${this.getSortedPlayers().map((player, index) => 
                    this.renderPlayerRow(player, index + 1)
                ).join('')}
            </div>
        `;
        container.innerHTML = html;
        this.bindSortEvents();
    }

    // 渲染单个球员行
    renderPlayerRow(player, rank) {
        const value = this.getPlayerValue(player);
        return `
            <div class="player-row ${rank <= 3 ? 'top-' + rank : ''}">
                <div class="col rank">${rank}</div>
                <div class="col">${player.name}</div>
                <div class="col">
                    <span class="value">${value}</span>
                    ${this.currentType !== 'total' ? `
                        <button class="edit-btn" onclick="playerStats.editValue('${player.name}')">
                            编辑
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // 获取球员在当前榜单的数值
    getPlayerValue(player) {
        if (this.currentBoard === 'attendance') {
            if (this.currentType === 'total') {
                return player.attendance.internal + player.attendance.external;
            }
            return player.attendance[this.currentType] || 0;
        } else {
            if (this.currentType === 'total') {
                return (player.stats.internal?.[this.currentBoard] || 0) + 
                       (player.stats.external?.[this.currentBoard] || 0);
            }
            return player.stats[this.currentType]?.[this.currentBoard] || 0;
        }
    }

    // 获取排序后的球员列表
    getSortedPlayers() {
        return [...this.players.mainPlayers].sort((a, b) => {
            if (this.sortField === 'name') {
                return this.sortDirection === 'desc' 
                    ? b.name.localeCompare(a.name)
                    : a.name.localeCompare(b.name);
            }
            
            const valueA = this.getPlayerValue(a);
            const valueB = this.getPlayerValue(b);
            return this.sortDirection === 'desc' ? valueB - valueA : valueA - valueB;
        });
    }

    // 编辑数值
    editValue(playerName) {
        if (this.currentType === 'total') return;
        
        const player = this.findPlayer(playerName);
        const currentValue = this.getPlayerValue(player);
        const boardText = this.getBoardTitle();

        const newValue = prompt(
            `请输入 ${playerName} 的${this.getTypeText(this.currentType)}${boardText}:`, 
            currentValue
        );

        if (newValue !== null && !isNaN(newValue)) {
            if (this.currentBoard === 'attendance') {
                player.attendance[this.currentType] = parseInt(newValue);
            } else {
                if (!player.stats[this.currentType]) {
                    player.stats[this.currentType] = { goals: 0, assists: 0 };
                }
                player.stats[this.currentType][this.currentBoard] = parseInt(newValue);
            }
            this.saveData();
            this.renderPlayerList();
        }
    }

    // 绑定事件
    bindEvents() {
        // 榜单切换
        document.querySelector('.stats-boards').addEventListener('click', (e) => {
            // 检查点击的是按钮或者按钮内的span
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
            // 检查点击的是按钮或者按钮内的span
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

    // 保存数据
    saveData() {
        localStorage.setItem('playerStats', JSON.stringify(this.players));
    }

    // 查找球员
    findPlayer(name) {
        return this.players.mainPlayers.find(p => p.name === name);
    }

    // 获取类型文本
    getTypeText(type) {
        const types = {
            total: '总',
            internal: '内战',
            external: '外战'
        };
        return types[type];
    }

    // 添加排序相关方法
    getSortIcon(field) {
        if (this.sortField !== field) return '↕️';
        return this.sortDirection === 'desc' ? '↓' : '↑';
    }

    bindSortEvents() {
        document.querySelectorAll('.sortable').forEach(header => {
            header.addEventListener('click', (e) => {
                const field = e.target.closest('.sortable').dataset.sort;
                
                if (field === this.sortField) {
                    this.sortDirection = this.sortDirection === 'desc' ? 'asc' : 'desc';
                } else {
                    this.sortField = field;
                    this.sortDirection = 'desc';
                }
                
                this.renderPlayerList();
            });
        });
    }
} 