class WinrateCalculator {
    constructor() {
        // 初始化 Supabase 客户端
        const { createClient } = supabase;
        this.supabaseClient = createClient(
            'https://obidukxlcgecpooynqnz.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iaWR1a3hsY2dlY3Bvb3lucW56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQyNjAyMDgsImV4cCI6MjA0OTgzNjIwOH0.a4Y-nWWxb8ClbMO2BUXG2vTJMqTJe2rQAXdWyKHZlHs'
        );
        this.isCalculating = false;
    }

    // 主要的胜率计算函数
    async calculateWinrates() {
        if (this.isCalculating) {
            console.log('胜率计算正在进行中...');
            return;
        }

        this.isCalculating = true;
        this.showProgress('开始计算胜率...');

        try {
            // 1. 获取2025年所有内战比赛数据
            const matches = await this.get2025InternalMatches();
            console.log(`找到 ${matches.length} 场2025年内战比赛`);

            // 2. 获取所有参赛球员数据
            const playerMatches = await this.getPlayerMatches(matches);
            console.log(`获取到球员参赛数据`);

            // 3. 计算每个球员的胜率统计
            const playerStats = await this.calculatePlayerStats(matches, playerMatches);
            console.log(`计算完成，共 ${Object.keys(playerStats).length} 名球员`);

            // 4. 更新数据库
            await this.updateWinrateTable(playerStats);
            
            this.showProgress('胜率计算完成！', 'success');
            
        } catch (error) {
            console.error('胜率计算失败:', error);
            this.showProgress(`计算失败: ${error.message}`, 'error');
        } finally {
            this.isCalculating = false;
        }
    }

    // 获取2025年所有内战比赛
    async get2025InternalMatches() {
        const { data, error } = await this.supabaseClient
            .from('matches')
            .select('*')
            .eq('match_type', '内战')
            .gte('match_date', '2025-01-01')
            .lt('match_date', '2026-01-01')
            .eq('status', 'completed')
            .order('match_date');

        if (error) {
            throw new Error(`获取比赛数据失败: ${error.message}`);
        }

        return data || [];
    }

    // 获取球员参赛记录
    async getPlayerMatches(matches) {
        const matchIds = matches.map(match => match.id);
        
        if (matchIds.length === 0) {
            return [];
        }

        const { data, error } = await this.supabaseClient
            .from('match_players')
            .select('*')
            .in('match_id', matchIds);

        if (error) {
            throw new Error(`获取球员参赛数据失败: ${error.message}`);
        }

        return data || [];
    }

    // 计算球员统计数据
    async calculatePlayerStats(matches, playerMatches) {
        const playerStats = {};

        // 创建比赛ID到比赛信息的映射
        const matchMap = {};
        matches.forEach(match => {
            matchMap[match.id] = match;
        });

        // 获取所有球员的正确类型信息
        const playerNames = [...new Set(playerMatches.map(pm => pm.player_name))];
        const { data: playersData, error } = await this.supabaseClient
            .from('players')
            .select('name, player_type')
            .in('name', playerNames);

        if (error) {
            console.warn('获取球员类型失败，使用默认值:', error.message);
        }

        // 创建球员名称到类型的映射
        const playerTypeMap = {};
        if (playersData) {
            playersData.forEach(player => {
                playerTypeMap[player.name] = player.player_type || 'regular';
            });
        }

        // 遍历每个球员的参赛记录
        playerMatches.forEach(playerMatch => {
            const match = matchMap[playerMatch.match_id];
            if (!match) return;

            const playerName = playerMatch.player_name;
            const team = playerMatch.team; // 'white' 或 'blue'
            // 从players表获取正确的player_type
            const playerType = playerTypeMap[playerName] || 'regular';

            // 初始化球员统计
            if (!playerStats[playerName]) {
                playerStats[playerName] = {
                    player_name: playerName,
                    player_type: playerType,
                    total_matches: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    win_rate: 0
                };
            }

            // 增加总场次
            playerStats[playerName].total_matches++;

            // 判断胜负平
            const whiteScore = match.white_score || 0;
            const blueScore = match.blue_score || 0;

            if (whiteScore === blueScore) {
                // 平局
                playerStats[playerName].draws++;
            } else if (
                (team === 'white' && whiteScore > blueScore) ||
                (team === 'blue' && blueScore > whiteScore)
            ) {
                // 胜利
                playerStats[playerName].wins++;
            } else {
                // 失败
                playerStats[playerName].losses++;
            }
        });

        // 计算胜率
        Object.values(playerStats).forEach(stats => {
            if (stats.total_matches > 0) {
                stats.win_rate = ((stats.wins / stats.total_matches) * 100).toFixed(2);
            }
        });

        return playerStats;
    }

    // 更新胜率表
    async updateWinrateTable(playerStats) {
        this.showProgress('正在更新数据库...');

        // 先清空现有数据
        const { error: deleteError } = await this.supabaseClient
            .from('player_winrate_2025')
            .delete()
            .neq('id', 0); // 删除所有记录

        if (deleteError) {
            throw new Error(`清空数据失败: ${deleteError.message}`);
        }

        // 插入新数据
        const statsArray = Object.values(playerStats);
        
        if (statsArray.length === 0) {
            console.log('没有数据需要插入');
            return;
        }

        const { error: insertError } = await this.supabaseClient
            .from('player_winrate_2025')
            .insert(statsArray);

        if (insertError) {
            throw new Error(`插入数据失败: ${insertError.message}`);
        }

        console.log(`成功更新 ${statsArray.length} 名球员的胜率数据`);
    }

    // 显示进度信息
    showProgress(message, type = 'info') {
        console.log(message);
        
        // 如果页面上有进度显示元素，更新它
        const progressElement = document.getElementById('winrate-progress');
        if (progressElement) {
            progressElement.textContent = message;
            progressElement.className = `progress-message ${type}`;
        }

        // 如果有按钮，更新按钮状态
        const calculateBtn = document.getElementById('calculate-winrate-btn');
        if (calculateBtn) {
            if (this.isCalculating) {
                calculateBtn.disabled = true;
                calculateBtn.textContent = '计算中...';
            } else {
                calculateBtn.disabled = false;
                calculateBtn.textContent = '计算胜率';
            }
        }
    }

    // 获取胜率排行榜数据
    async getWinrateRanking(minMatches = 3) {
        const { data, error } = await this.supabaseClient
            .from('player_winrate_2025')
            .select('*')
            .gte('total_matches', minMatches)
            .order('win_rate', { ascending: false });

        if (error) {
            throw new Error(`获取胜率排行失败: ${error.message}`);
        }

        return data || [];
    }

    // 获取所有胜率数据
    async getAllWinrateData() {
        const { data, error } = await this.supabaseClient
            .from('player_winrate_2025')
            .select('*')
            .order('total_matches', { ascending: false });

        if (error) {
            throw new Error(`获取胜率数据失败: ${error.message}`);
        }

        return data || [];
    }

    // 获取2025年内战总数
    async getTotalInternalMatches() {
        const { count, error } = await this.supabaseClient
            .from('matches')
            .select('*', { count: 'exact', head: true })
            .eq('match_type', '内战')
            .gte('match_date', '2025-01-01')
            .lt('match_date', '2026-01-01')
            .eq('status', 'completed');

        if (error) {
            throw new Error(`获取内战总数失败: ${error.message}`);
        }

        return count || 0;
    }
}

// 全局实例
let winrateCalculator = null;

// 初始化函数
function initWinrateCalculator() {
    if (!winrateCalculator) {
        winrateCalculator = new WinrateCalculator();
    }
    return winrateCalculator;
}

// 导出给其他文件使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WinrateCalculator, initWinrateCalculator };
}