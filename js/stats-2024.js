// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 初始化标签切换功能
    initTabs();
    // 初始化分类切换功能
    initCategories();
    // 加载初始数据
    loadData('attendance', 'total');
});

// 初始化标签切换
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // 移除所有active类
            tabBtns.forEach(b => b.classList.remove('active'));
            // 添加active类到当前按钮
            this.classList.add('active');
            
            // 切换内容显示
            const tabId = this.dataset.tab;
            const sections = document.querySelectorAll('.stats-section');
            sections.forEach(section => {
                section.classList.remove('active');
                if (section.id === tabId) {
                    section.classList.add('active');
                }
            });

            // 加载对应数据
            const activeCategory = document.querySelector('.category-btn.active').dataset.category;
            loadData(tabId, activeCategory);
        });
    });
}

// 初始化分类切换
function initCategories() {
    const categoryBtns = document.querySelectorAll('.category-btn');
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // 移除所有active类
            categoryBtns.forEach(b => b.classList.remove('active'));
            // 添加active类到当前按钮
            this.classList.add('active');
            
            // 加载对应数据
            const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
            const category = this.dataset.category;
            loadData(activeTab, category);
        });
    });
}

// 加载数据函数
function loadData(type, category) {
    // 从localStorage获取数据
    const data = getStatsData(type, category);
    
    // 更新表格内容
    const tbody = document.getElementById(`${type}Data`);
    tbody.innerHTML = ''; // 清空现有数据

    // 根据不同类型生成不同的表格行
    data.forEach((item, index) => {
        const tr = document.createElement('tr');
        
        // 根据不同的统计类型显示不同的数据
        switch(type) {
            case 'attendance':
                tr.innerHTML = `
                    <td><div class="rank ${index < 3 ? 'rank-' + (index + 1) : ''}">${index + 1}</div></td>
                    <td>${item.name}</td>
                    <td>${item.count}</td>
                    <td>${item.rate}%</td>
                `;
                break;
            case 'goals':
            case 'assists':
                tr.innerHTML = `
                    <td><div class="rank ${index < 3 ? 'rank-' + (index + 1) : ''}">${index + 1}</div></td>
                    <td>${item.name}</td>
                    <td>${item.count}</td>
                    <td>${item.average.toFixed(2)}</td>
                `;
                break;
        }
        
        tbody.appendChild(tr);
    });
}

// 获取统计数据
function getStatsData(type, category) {
    // 这里应该从localStorage获取实际数据
    // 现在返回示例数据
    return [
        { name: "张三", count: 15, rate: 88, average: 1.2 },
        { name: "李四", count: 12, rate: 75, average: 1.0 },
        { name: "王五", count: 10, rate: 63, average: 0.8 }
    ];
} 