// 炼知 ReKnow v6 - 精简版核心逻辑

class ReKnowApp {
    constructor() {
        this.currentTopic = null;
        this.currentQuestion = 0;
        this.timerSeconds = 0;
        this.timerInterval = null;
        this.init();
    }

    init() {
        this.loadCollections();
        this.bindEvents();
        this.updateStats();
        this.setupPageAnimations();
    }

    // 加载收藏列表
    loadCollections() {
        const container = document.getElementById('collection-cards');
        container.innerHTML = '';
        
        DATA.collections.forEach((topic, index) => {
            const card = this.createCollectionCard(topic);
            container.appendChild(card);
            
            // 渐入动画
            setTimeout(() => {
                card.classList.add('fade-in');
            }, index * 100);
        });
    }

    // 创建收藏卡片
    createCollectionCard(topic) {
        const card = document.createElement('div');
        card.className = collection-card ;
        card.onclick = () => this.startLearning(topic.id);
        
        card.innerHTML = 
            <div class="card-header">
                <div class="question-title"></div>
                <div class="card-meta">
                    <span class="meta-item">👁️  热度</span>
                    <span class="meta-item">👤 </span>
                    <span class="meta-item">📅 </span>
                </div>
            </div>
            <div class="card-content">
                <div class="core-insight">💡 核心：</div>
            </div>
            <div class="learning-status ">
                <span></span>
                <span></span>
            </div>
            <button class="start-button " >
                
            </button>
        ;
        
        return card;
    }

    // 开始学习
    startLearning(topicId) {
        const topic = DATA.collections.find(t => t.id === topicId);
        if (!topic || topic.learned) return;
        
        this.currentTopic = topic;
        document.getElementById('collection-view').style.display = 'none';
        document.getElementById('decompose-view').style.display = 'block';
        
        this.updateDecomposeContent(topic);
        
        // 滚动到拆解界面
        document.getElementById('decompose-view').scrollIntoView({ behavior: 'smooth' });
    }

    // 更新拆解内容
    updateDecomposeContent(topic) {
        const title = document.querySelector('.decompose-title');
        title.textContent = 🔍 快速拆解 - ...;
        
        const cardsContainer = document.getElementById('knowledge-cards');
        cardsContainer.innerHTML = '';
        
        topic.blocks.forEach((block, index) => {
            const card = this.createKnowledgeCard(block);
            cardsContainer.appendChild(card);
            
            // 渐入动画
            setTimeout(() => {
                card.classList.add('fade-in');
            }, index * 100);
        });
    }

    // 创建知识卡片
    createKnowledgeCard(block) {
        const card = document.createElement('div');
        card.className = 'knowledge-card';
        
        const typeInfo = DATA.blockTypes[block.type];
        card.innerHTML = 
            <div class="card-type type-"></div>
            <div class="card-content"></div>
            <div class="card-source">— </div>
        ;
        
        return card;
    }

    // 一键全懂并开始学习
    markAllAndStartLearning() {
        const cards = document.querySelectorAll('.knowledge-card');
        cards.forEach(card => {
            card.classList.add('all-marked');
        });
        
        setTimeout(() => {
            this.showQuickLearning();
        }, 800);
    }

    // 显示快速学习
    showQuickLearning() {
        document.getElementById('decompose-view').style.display = 'none';
        document.getElementById('learning-view').style.display = 'block';
        
        this.currentQuestion = 0;
        this.timerSeconds = 0;
        this.updateQuizContent();
        this.startTimer();
        
        // 滚动到学习界面
        document.getElementById('learning-view').scrollIntoView({ behavior: 'smooth' });
    }

    // 更新学习内容
    updateQuizContent() {
        const topic = this.currentTopic;
        const question = topic.quiz[this.currentQuestion];
        
        document.getElementById('quiz-question').textContent = question.question;
        document.getElementById('question-num').textContent = ${this.currentQuestion + 1}/;
        
        const optionsContainer = document.getElementById('quiz-options');
        optionsContainer.innerHTML = '';
        
        question.options.forEach((option, index) => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'quiz-option';
            optionDiv.textContent = option;
            optionDiv.onclick = () => this.selectAnswer(optionDiv, index === question.correct);
            optionsContainer.appendChild(optionDiv);
        });
        
        // 更新进度条
        const progress = ((this.currentQuestion + 1) / topic.quiz.length) * 100;
        document.getElementById('progress-fill').style.width = ${progress}%;
    }

    // 开始计时
    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        
        this.timerInterval = setInterval(() => {
            this.timerSeconds++;
            const minutes = Math.floor(this.timerSeconds / 60);
            const seconds = this.timerSeconds % 60;
            document.getElementById('timer').textContent = 
                ${minutes.toString().padStart(2, '0')}:;
        }, 1000);
    }

    // 选择答案
    selectAnswer(option, isCorrect) {
        const options = document.querySelectorAll('.quiz-option');
        options.forEach(opt => opt.classList.add('selected'));
        
        option.classList.add(isCorrect ? 'correct' : 'wrong');
        
        setTimeout(() => {
            this.currentQuestion++;
            if (this.currentQuestion >= this.currentTopic.quiz.length) {
                this.showAchievement();
            } else {
                this.updateQuizContent();
            }
        }, 1500);
    }

    // 显示成就
    showAchievement() {
        clearInterval(this.timerInterval);
        
        const popup = document.getElementById('achievement-popup');
        const desc = document.getElementById('achievement-desc');
        
        const title = this.currentTopic.question.substring(0, 20);
        desc.textContent = 「...」已加入你的知识库，炉火值 +50;
        
        popup.classList.add('show');
    }

    // 继续学习下一篇
    continueToNext() {
        document.getElementById('achievement-popup').classList.remove('show');
        this.backToCollection();
        
        // 标记为已学懂
        this.currentTopic.learned = true;
        this.updateStats();
        
        // 随机推荐下一篇
        setTimeout(() => {
            this.randomRecommend();
        }, 500);
    }

    // 返回收藏列表
    backToCollection() {
        document.getElementById('learning-view').style.display = 'none';
        document.getElementById('decompose-view').style.display = 'none';
        document.getElementById('collection-view').style.display = 'block';
        
        // 重新加载收藏列表以更新状态
        this.loadCollections();
    }

    // 返回拆解界面
    backToDecompose() {
        document.getElementById('learning-view').style.display = 'none';
        document.getElementById('decompose-view').style.display = 'block';
        clearInterval(this.timerInterval);
    }

    // 随机推荐
    randomRecommend() {
        const unlearnedCards = document.querySelectorAll('.collection-card:not(.learned)');
        if (unlearnedCards.length === 0) return;
        
        const randomCard = unlearnedCards[Math.floor(Math.random() * unlearnedCards.length)];
        randomCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // 高亮效果
        randomCard.classList.add('highlight');
    }

    // 搜索收藏
    searchCollection(query) {
        const cards = document.querySelectorAll('.collection-card');
        if (query.trim() === '') {
            cards.forEach(card => card.style.display = 'block');
            return;
        }
        
        const lowerQuery = query.toLowerCase();
        cards.forEach(card => {
            const title = card.querySelector('.question-title').textContent.toLowerCase();
            const author = card.querySelector('.meta-item:nth-child(2)').textContent.toLowerCase();
            const core = card.querySelector('.core-insight').textContent.toLowerCase();
            
            if (title.includes(lowerQuery) || author.includes(lowerQuery) || core.includes(lowerQuery)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    // 更新统计
    updateStats() {
        const learned = DATA.collections.filter(t => t.learned).length;
        const total = DATA.collections.length;
        
        document.querySelector('.stats').innerHTML = 
            <div class="stat-item">
                <span>📚  篇收藏</span>
            </div>
            <div class="stat-item learned">
                <span>✨  篇已学懂</span>
            </div>
        ;
        
        DATA.stats.learned = learned;
        DATA.stats.total = total;
    }

    // 格式化投票数
    formatVotes(votes) {
        if (votes >= 1000) return ${(votes / 1000).toFixed(1)}K;
        return votes.toString();
    }

    // 绑定事件
    bindEvents() {
        // 搜索框事件
        document.getElementById('search-input').addEventListener('keyup', (e) => {
            this.searchCollection(e.target.value);
        });
        
        // 全局函数绑定（用于HTML的onclick）
        window.randomRecommend = () => this.randomRecommend();
        window.backToCollection = () => this.backToCollection();
        window.markAllAndStartLearning = () => this.markAllAndStartLearning();
        window.backToDecompose = () => this.backToDecompose();
        window.continueToNext = () => this.continueToNext();
        window.kanshanClick = () => this.kanshanClick();
        window.showUniverse = () => this.showUniverse();
    }

    // 看山点击
    kanshanClick() {
        const kanshan = document.querySelector('.kanshan-corner');
        kanshan.style.transform = 'scale(1.2) rotate(360deg)';
        setTimeout(() => {
            kanshan.style.transform = 'scale(1.1)';
        }, 300);
    }

    // 显示宇宙
    showUniverse() {
        const learned = DATA.collections.filter(t => t.learned).length;
        const stats = DATA.stats;
        
        const message = 🌌 炼金宇宙成就展示\\n\\n✨ 已点亮星球： 颗\\n🔥 炉火等级：Lv.\\n🏆 成就：连续学习  篇\\n\\n你的知识宇宙正在成长...;
        
        alert(message);
    }

    // 设置页面动画
    setupPageAnimations() {
        // 页面加载完成后的动画
        window.addEventListener('load', () => {
            this.loadCollections();
        });
    }
}

// 应用初始化
document.addEventListener('DOMContentLoaded', () => {
    new ReKnowApp();
});

// 状态持久化
function saveState() {
    localStorage.setItem('recknow_state', JSON.stringify({
        collections: DATA.collections.map(t => ({ id: t.id, learned: t.learned })),
        stats: DATA.stats
    }));
}

function loadState() {
    const saved = localStorage.getItem('recknow_state');
    if (saved) {
        const state = JSON.parse(saved);
        state.collections.forEach(saved => {
            const topic = DATA.collections.find(t => t.id === saved.id);
            if (topic) topic.learned = saved.learned;
        });
        if (state.stats) DATA.stats = state.stats;
    }
}

// 加载保存的状态
loadState();

// 页面卸载时保存状态
window.addEventListener('beforeunload', saveState);
