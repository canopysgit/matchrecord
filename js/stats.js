class PlayerStats {
    constructor() {
        this.initializePlayersIfNeeded();
        this.players = this.loadPlayers();
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
                        goals: 0,
                        assists: 0
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
        this.renderTabs();
        this.renderPlayerList();
        this.bindEvents();
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
    renderPlayerList(tabType = 'total') {
        const container = document.querySelector('.stats-content');
        const html = `
            <div class="stats-table">
                <div class="table-header">
                    <div class="col">球员</div>
                    <div class="col">出勤次数</div>
                    <div class="col">进球</div>
                    <div class="col">助攻</div>
                </div>
                ${this.players.mainPlayers.map(player => this.renderPlayerRow(player, tabType)).join('')}
            </div>
        `;
        container.innerHTML = html;
    }

    // 渲染单个球员行
    renderPlayerRow(player, tabType) {
        // 计算显示的数据
        const stats = this.calculatePlayerStats(player, tabType);

        return `
            <div class="player-row" data-player="${player.name}">
                <div class="col">${player.name}</div>
                <div class="col attendance">
                    <span class="value">${stats.attendance}</span>
                    ${tabType !== 'total' ? `
                        <button class="edit-btn" onclick="playerStats.editAttendance('${player.name}', '${tabType}')">
                            编辑
                        </button>
                    ` : ''}
                </div>
                <div class="col stats">
                    <span class="value">${stats.goals}</span>
                    ${tabType !== 'total' ? `
                        <button class="edit-btn" onclick="playerStats.editStats('${player.name}', '${tabType}', 'goals')">
                            编辑
                        </button>
                    ` : ''}
                </div>
                <div class="col stats">
                    <span class="value">${stats.assists}</span>
                    ${tabType !== 'total' ? `
                        <button class="edit-btn" onclick="playerStats.editStats('${player.name}', '${tabType}', 'assists')">
                            编辑
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // 计算球员统计数据
    calculatePlayerStats(player, tabType) {
        if (tabType === 'total') {
            return {
                attendance: player.attendance.internal + player.attendance.external,
                goals: (player.stats.internal?.goals || 0) + (player.stats.external?.goals || 0),
                assists: (player.stats.internal?.assists || 0) + (player.stats.external?.assists || 0)
            };
        }
        return {
            attendance: player.attendance[tabType] || 0,
            goals: player.stats[tabType]?.goals || 0,
            assists: player.stats[tabType]?.assists || 0
        };
    }

    // 编辑出勤次数
    editAttendance(playerName, type) {
        if (type === 'total') return; // 总榜不允许编辑
        
        const player = this.findPlayer(playerName);
        const currentValue = player.attendance[type] || 0;

        const newValue = prompt(`请输入 ${playerName} 的${this.getTypeText(type)}出勤次数:`, currentValue);
        if (newValue !== null && !isNaN(newValue)) {
            player.attendance[type] = parseInt(newValue);
            this.saveData();
            this.renderPlayerList(type);
        }
    }

    // 编辑统计数据
    editStats(playerName, type, statType) {
        if (type === 'total') return; // 总榜不允许编辑
        
        const player = this.findPlayer(playerName);
        if (!player.stats[type]) {
            player.stats[type] = { goals: 0, assists: 0 };
        }
        const currentValue = player.stats[type][statType] || 0;

        const newValue = prompt(`请输入 ${playerName} 的${type}${this.getStatText(statType)}:`, currentValue);
        if (newValue !== null && !isNaN(newValue)) {
            player.stats[type][statType] = parseInt(newValue);
            this.saveData();
            this.renderPlayerList(type);
        }
    }

    // 添加新球员
    showAddPlayerModal() {
        const name = prompt('请输入新球员姓名:');
        if (name) {
            this.players.mainPlayers.push({
                name,
                attendance: { internal: 0, external: 0 },
                stats: { goals: 0, assists: 0 }
            });
            this.saveData();
            this.renderPlayerList('total');
        }
    }

    // 删除球员
    deletePlayer(playerName) {
        if (confirm(`确定要删除 ${playerName} 的数据吗？`)) {
            this.players.mainPlayers = this.players.mainPlayers.filter(p => p.name !== playerName);
            this.saveData();
            this.renderPlayerList('total');
        }
    }

    // 保存数据
    saveData() {
        localStorage.setItem('playerStats', JSON.stringify(this.players));
    }

    // 绑定事件
    bindEvents() {
        document.querySelector('.stats-tabs').addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-btn')) {
                document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                this.renderPlayerList(e.target.dataset.tab);
            }
        });
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

    // 获取统计类型文本
    getStatText(type) {
        const types = {
            goals: '进球数',
            assists: '助攻数'
        };
        return types[type];
    }
} 