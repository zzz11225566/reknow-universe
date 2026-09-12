// 炼知 ReKnow v6 - 简化后端服务
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8787;

// MIME类型映射
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// 创建HTTP服务器
const server = http.createServer((req, res) => {
    const url = req.url;
    const method = req.method;

    // 处理静态文件请求
    if (method === 'GET' && !url.startsWith('/api/')) {
        let filePath = path.join(__dirname, url === '/' ? 'index.html' : url);
        
        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>404 - 页面未找到</h1>');
            return;
        }

        // 获取文件扩展名并设置Content-Type
        const ext = path.extname(filePath);
        const contentType = mimeTypes[ext] || 'text/plain';

        // 读取并返回文件内容
        fs.readFile(filePath, (err, content) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end('<h1>500 - 服务器错误</h1>');
                return;
            }

            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        });
    }

    // API路由
    if (url.startsWith('/api/') && method === 'GET') {
        handleAPI(req, res);
    }
});

// API处理函数
function handleAPI(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });

    const url = req.url;

    // 获取收藏列表
    if (url === '/api/collections') {
        const collections = JSON.parse(fs.readFileSync('data.js', 'utf8')).collections;
        const simplifiedCollections = collections.map(t => ({
            id: t.id,
            question: t.question,
            author: t.author,
            votes: t.votes,
            time: t.time,
            core: t.core,
            learned: t.learned,
            category: t.category
        }));
        
        res.end(JSON.stringify({ collections: simplifiedCollections }));
    }

    // 获取学习统计
    if (url === '/api/stats') {
        const data = JSON.parse(fs.readFileSync('data.js', 'utf8'));
        const learned = data.collections.filter(t => t.learned).length;
        const total = data.collections.length;
        
        res.end(JSON.stringify({ 
            total, 
            learned, 
            progress: Math.round((learned / total) * 100) 
        }));
    }

    // 随机推荐API
    if (url === '/api/recommend') {
        const data = JSON.parse(fs.readFileSync('data.js', 'utf8'));
        const unlearned = data.collections.filter(t => !t.learned);
        if (unlearned.length > 0) {
            const random = unlearned[Math.floor(Math.random() * unlearned.length)];
            res.end(JSON.stringify({ topic: random }));
        } else {
            res.end(JSON.stringify({ message: '所有收藏都已学懂' }));
        }
    }

    // 默认响应
    if (!url.includes('/api/')) {
        res.end(JSON.stringify({ message: 'API endpoint not found' }));
    }
}

// 服务器启动监听
server.listen(PORT, () => {
    console.log('🔥 炼知 ReKnow v6 服务器启动成功！');
    console.log('📱 访问地址：http://localhost:' + PORT);
    console.log('🌌 炼金宇宙成就展示：http://localhost:' + PORT + '/api/stats');
    console.log('🚀 服务器运行在端口 ' + PORT);
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('🛹 服务器正在关闭...');
    server.close(() => {
        console.log('✅ 服务器已关闭');
        process.exit(0);
    });
});
