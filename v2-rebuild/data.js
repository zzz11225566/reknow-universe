// 炼知 ReKnow v6 - 数据结构
window.DATA = {
    // 收藏数据
    collections: [
        {
            id: 'feynman',
            question: '费曼学习法真的有用吗？我用它三个月背完考研专业课',
            author: '李思考',
            votes: 8400,
            time: '3 天前',
            core: '能不用术语、把一件事讲给外行听，才算真的会。',
            learned: true,
            category: 'study',
            blocks: [
                { type: 'concept', content: '费曼技巧的核心：用「教别人」来检验「自己懂没懂」。', source: '李思考' },
                { type: 'method', content: '四步走：选概念 → 讲给 12 岁孩子 → 卡住就补课 → 换类比再讲。', source: '李思考' },
                { type: 'principle', content: '认知科学里的「测试效应」：主动回忆比反复阅读记得牢。', source: '《Make It Stick》' },
                { type: 'example', content: '把量子力学讲给奶奶听：如果说不明白，就是自己还没真懂。', source: '李思考' },
                { type: 'tip', content: '收藏夹不是大脑，只是仓库。仓库里的东西不会自己变成能力。', source: '李思考' }
            ],
            quiz: [
                {
                    question: '🤔 根据费曼学习法，检验自己是否真正理解的最好方式是什么？',
                    options: ['A. 反复阅读原文直到记住所有细节', 'B. 用简单的语言把这个概念讲给外行听', 'C. 做大量的相关练习题', 'D. 把所有相关的术语都背诵下来'],
                    correct: 1
                },
                {
                    question: '🤔 为什么费曼学习法比死记硬背更有效？',
                    options: ['A. 因为它更有趣', 'B. 它利用了主动回忆的认知原理', 'C. 它需要更少的时间', 'D. 它更容易记忆'],
                    correct: 1
                },
                {
                    question: '🤔 当你用费曼技巧"卡住"时，这说明了什么？',
                    options: ['A. 你的记忆力有问题', 'B. 你自己还没完全理解这个概念', 'C. 这个概念太难了', 'D. 你需要更多的练习'],
                    correct: 1
                }
            ]
        },
        {
            id: 'procrastination',
            question: '如何克服拖延症？从心理学角度谈解决方案',
            author: '心理学小王',
            votes: 6200,
            time: '1 天前',
            core: '拖延不是懒，是对任务的情感反应失调。',
            learned: false,
            category: 'work',
            blocks: [
                { type: 'concept', content: '拖延不是时间管理问题，而是情绪调节问题。当任务引发焦虑、不安等负面情绪时，大脑会选择回避。', source: '心理学小王' },
                { type: 'method', content: '"2分钟法则"：任何任务，先做 2 分钟。大脑的启动成本远高于持续成本。', source: '心理学小王' },
                { type: 'principle', content: '"预期障碍"理论：我们高估任务的困难度，低估自己的完成能力。完成后的实际感受往往比预期好。', source: '《拖延心理学》' },
                { type: 'example', content: '写报告时，不要想着"我要写 3000 字"，而是想"我先打开文档，写第一句话"。', source: '心理学小王' },
                { type: 'tip', content: '完美的拖延症解方不存在，重点是"开始行动"而不是"消除拖延"。', source: '心理学小王' }
            ],
            quiz: [
                {
                    question: '🤔 根据拖延症的心理学原理，拖延的根本原因是什么？',
                    options: ['A. 时间管理能力差，不会安排计划', 'B. 对任务的负面情绪导致大脑选择回避', 'C. 性格懒惰，缺乏自我约束力', 'D. 任务太难，超出个人能力范围'],
                    correct: 1
                },
                {
                    question: '🤔 "2分钟法则"为什么有效？其背后的心理学原理是什么？',
                    options: ['A. 两分钟时间刚好完成简单任务', 'B. 降低启动门槛，让大脑开始行动', 'C. 两分钟内注意力最集中', 'D. 符合番茄工作法的原理'],
                    correct: 1
                },
                {
                    question: '🤔 当你对一项任务感到拖延时，最有效的应对策略是什么？',
                    options: ['A. 制定详细的时间计划表', 'B. 强制自己坐在桌前直到完成', 'C. 先做一个最小版本的行动', 'D. 找别人监督和督促自己'],
                    correct: 2
                }
            ]
        },
        {
            id: 'memory',
            question: '为什么背了忘、忘了背？记忆的科学原理与实用技巧',
            author: '记忆专家',
            votes: 4800,
            time: '5 天前',
            core: '间隔重复 + 主动回忆，比死记硬背有效 10 倍。',
            learned: false,
            category: 'study',
            blocks: [
                { type: 'concept', content: '记忆不是存储，而是重构。每次回忆都是在重新构建记忆路径。', source: '记忆专家' },
                { type: 'method', content: '间隔重复：1天后、3天后、7天后、1个月后，每个时间点复习一次。', source: '记忆专家' },
                { type: 'principle', content: '遗忘曲线：记忆在前 24 小时内遗忘最快，之后逐渐平缓。', source: '《认知心理学》' },
                { type: 'example', content: '背单词时，不要一遍遍地读，而是测验自己："这个单词什么意思？"', source: '记忆专家' },
                { type: 'tip', content: '主动回忆比被动阅读效果好 3 倍，这是记忆的核心秘密。', source: '记忆专家' }
            ],
            quiz: [
                {
                    question: '🤔 根据记忆科学，最有效的记忆方法是什么？',
                    options: ['A. 大量重复阅读', 'B. 间隔重复 + 主动回忆', 'C. 一次性背诵所有内容', 'D. 使用记忆宫殿'],
                    correct: 1
                },
                {
                    question: '🤔 为什么我们在学习后的24小时内遗忘最快？',
                    options: ['A. 因为大脑容量有限', 'B. 遗忘曲线的自然规律', 'C. 因为注意力不集中', 'D. 因为学习效率低'],
                    correct: 1
                },
                {
                    question: '🤔 "主动回忆"为什么比"被动阅读"更有效？',
                    options: ['A. 因为它更有挑战性', 'B. 因为它激活了更深层的认知加工', 'C. 因为它需要更少时间', 'D. 因为它更容易'],
                    correct: 1
                }
            ]
        },
        {
            id: 'focus',
            question: '深度工作：如何在信息爆炸的时代保持专注',
            author: '效率达人',
            votes: 7100,
            time: '2 天前',
            core: '专注不是天赋，是可以刻意练习的肌肉。',
            learned: true,
            category: 'work',
            blocks: [
                { type: 'concept', content: '专注力是一种有限的认知资源，需要像肌肉一样刻意练习。', source: '效率达人' },
                { type: 'method', content: '番茄工作法：25 分钟专注 + 5 分钟休息，重复循环。', source: '效率达人' },
                { type: 'principle', content: '注意力残留理论：切换任务时，大脑仍停留在上一个任务，降低效率。', source: '《深度工作》' },
                { type: 'example', content: '写作时关闭手机通知，只在特定时间查看邮件。', source: '效率达人' },
                { type: 'tip', content: '环境设计比意志力更可靠：创造无干扰的工作空间。', source: '效率达人' }
            ],
            quiz: [
                {
                    question: '🤔 根据深度工作理论，提高专注力的关键是？',
                    options: ['A. 增强意志力', 'B. 创造无干扰环境', 'C. 延长工作时间', 'D. 学习更多技巧'],
                    correct: 1
                },
                {
                    question: '🤔 番茄工作法的核心原理是什么？',
                    options: ['A. 工作25分钟就休息', 'B. 利用时间间隔保持注意力', 'C. 它让工作更有趣', 'D. 它符合生物节律'],
                    correct: 1
                },
                {
                    question: '🤔 为什么多任务处理会降低效率？',
                    options: ['A. 因为大脑不够聪明', 'B. 注意力残留认知成本', 'C. 因为时间不够用', 'D. 因为任务太复杂'],
                    correct: 1
                }
            ]
        },
        {
            id: 'thinking',
            question: '批判性思维：如何避免被观点和情绪左右',
            author: '思维教练',
            votes: 5300,
            time: '4 天前',
            core: '好观点不等于正确观点，区分事实和判断是关键。',
            learned: false,
            category: 'write',
            blocks: [
                { type: 'concept', content: '批判性思维不是批判一切，而是对观点进行理性评估的能力。', source: '思维教练' },
                { type: 'method', content: 'S-O-R分析法：情境-观点-理由，拆解任何观点的构成要素。', source: '思维教练' },
                { type: 'principle', content: '认知偏差：大脑天生倾向于 shortcuts，这些捷径往往是错误之源。', source: '《思考，快与慢》' },
                { type: 'example', content: '看到"专家说"，先问：这个专家的领域是否相关？是否有利益冲突？', source: '思维教练' },
                { type: 'tip', content: '好的批判性思维者不是怀疑论者，而是理性怀疑者。', source: '思维教练' }
            ],
            quiz: [
                {
                    question: '🤔 批判性思维的核心是什么？',
                    options: ['A. 怀疑一切', 'B. 对观点进行理性评估', 'C. 找出别人的错误', 'D. 坚持自己的观点'],
                    correct: 1
                },
                {
                    question: '🤔 为什么大脑容易产生认知偏差？',
                    options: ['A. 因为大脑不聪明', 'B. 因为天生的思维快捷方式', 'C. 因为教育不够', 'D. 因为经验不足'],
                    correct: 1
                },
                {
                    question: '🤔 面对一个观点时，第一步应该做什么？',
                    options: ['A. 立即接受或拒绝', 'B. 拆解观点的构成要素', 'C. 寻找支持者', 'D. 表达自己的态度'],
                    correct: 1
                }
            ]
        }
    ],
    
    // 全局状态
    stats: {
        total: 23,
        learned: 8
    },
    
    // 知识块类型
    blockTypes: {
        concept: { name: '概念', color: '#5b6ef5' },
        method: { name: '方法', color: '#e8923c' },
        principle: { name: '原理', color: '#16a05d' },
        example: { name: '例子', color: '#e05a8a' },
        tip: { name: '提醒', color: '#ffc107' }
    }
};
