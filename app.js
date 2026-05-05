const API = 'https://api.coingecko.com/api/v3';
let portfolio = JSON.parse(localStorage.getItem('cryptoPortfolio')) || [
    { id: 'bitcoin', amount: 0.5 },
    { id: 'ethereum', amount: 5 }
];
let marketData = [];
let selectedCoinId = 'bitcoin';
let mainChart = null;

// INIT
document.addEventListener('DOMContentLoaded', () => {
    init();
});

async function init() {
    bindEvents();
    await fetchData();
    renderNews();
    hideLoading();
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.opacity = '0';
    setTimeout(() => overlay.style.display = 'none', 500);
}

// FETCH DATA
async function fetchData() {
    try {
        const ids = portfolio.map(p => p.id).join(',');
        // Pobieramy dane dla portfela + topki do wyszukiwarki
        const response = await fetch(`${API}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=true&price_change_percentage=24h`);
        marketData = await response.json();
        
        refreshUI();
    } catch (err) {
        console.error("API Error:", err);
    }
}

function refreshUI() {
    renderSidebar();
    renderHoldings();
    updateDetailPanel();
    updateMainChart();
    renderGainers();
}

// RENDERING
function renderSidebar() {
    const container = document.getElementById('sidebarAssets');
    container.innerHTML = marketData.map(coin => `
        <div class="asset-item ${coin.id === selectedCoinId ? 'active' : ''}" onclick="selectCoin('${coin.id}')">
            <img src="${coin.image}" alt="">
            <span class="ticker">${coin.symbol.toUpperCase()}</span>
            <span class="change ${coin.price_change_percentage_24h >= 0 ? 'up' : 'down'}">
                ${coin.price_change_percentage_24h?.toFixed(2)}%
            </span>
        </div>
    `).join('');
}

function renderHoldings() {
    const container = document.getElementById('holdingsList');
    container.innerHTML = marketData.map(coin => {
        const h = portfolio.find(p => p.id === coin.id);
        const value = coin.current_price * h.amount;
        return `
            <div class="holding">
                <div class="coin-info">
                    <img src="${coin.image}">
                    <div>
                        <p class="name">${coin.name}</p>
                        <p class="sub">${coin.symbol.toUpperCase()}</p>
                    </div>
                </div>
                <div class="balance">${h.amount}</div>
                <div class="value">$${value.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                <div class="actions">
                    <button onclick="removeCoin('${coin.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    }).join('');
}

function updateDetailPanel() {
    const coin = marketData.find(c => c.id === selectedCoinId) || marketData[0];
    if (!coin) return;

    document.getElementById('detailImg').src = coin.image;
    document.getElementById('detailName').textContent = coin.name;
    document.getElementById('detailSymbol').textContent = coin.symbol.toUpperCase();
    document.getElementById('detailPrice').textContent = `$${coin.current_price.toLocaleString()}`;
    
    const changeEl = document.getElementById('detailChange');
    const ch = coin.price_change_percentage_24h || 0;
    changeEl.textContent = `${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%`;
    changeEl.className = `change-tag ${ch >= 0 ? 'up' : 'down'}`;

    // Sentiment bar simulation
    const sentiment = Math.min(95, Math.max(5, 50 + (ch * 3)));
    document.getElementById('progressFill').style.width = sentiment + '%';
    document.getElementById('progressText').textContent = Math.round(sentiment) + '%';
}

// CHART LOGIC
function updateMainChart() {
    const ctx = document.getElementById('mainChart').getContext('2d');
    const coin = marketData.find(c => c.id === selectedCoinId);
    
    if (!coin || !coin.sparkline_in_7d) return;

    if (mainChart) mainChart.destroy();

    const prices = coin.sparkline_in_7d.price;
    const labels = prices.map((_, i) => i);

    mainChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Price',
                data: prices,
                borderColor: '#4a9eff',
                borderWidth: 2,
                fill: true,
                backgroundColor: 'rgba(74, 158, 255, 0.1)',
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { display: false },
                y: { grid: { color: '#222' }, ticks: { color: '#666' } }
            }
        }
    });
}

// EVENTS
function bindEvents() {
    document.getElementById('refreshBtn').onclick = () => fetchData();
    document.getElementById('addCoinBtn').onclick = () => openModal();
    document.getElementById('closeModal').onclick = () => closeModal();
    
    document.getElementById('coinSearch').oninput = (e) => searchAndRender(e.target.value);
    
    document.getElementById('searchInput').oninput = (e) => {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll('.holding').forEach(el => {
            el.style.display = el.textContent.toLowerCase().includes(q) ? 'flex' : 'none';
        });
    };
}

function selectCoin(id) {
    selectedCoinId = id;
    refreshUI();
}

async function removeCoin(id) {
    portfolio = portfolio.filter(p => p.id !== id);
    save();
    await fetchData();
}

// MODAL SEARCH (COINGECKO TRENDING/TOP)
async function openModal() {
    document.getElementById('addCoinModal').classList.add('active');
    searchAndRender('');
}

async function searchAndRender(query) {
    const list = document.getElementById('coinList');
    list.innerHTML = '<div class="spinner"></div>';
    
    try {
        const res = await fetch(`${API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50`);
        const coins = await res.json();
        
        const filtered = coins.filter(c => 
            c.name.toLowerCase().includes(query.toLowerCase()) || 
            c.symbol.toLowerCase().includes(query.toLowerCase())
        );

        list.innerHTML = filtered.map(c => `
            <div class="coin-search-item" onclick="addCoin('${c.id}')">
                <img src="${c.image}">
                <span>${c.name} (${c.symbol.toUpperCase()})</span>
                <i class="fas fa-plus"></i>
            </div>
        `).join('');
    } catch (e) { list.innerHTML = "Error loading coins."; }
}

function addCoin(id) {
    if (portfolio.some(p => p.id === id)) return alert("Already in portfolio!");
    portfolio.push({ id: id, amount: 1 });
    save();
    fetchData();
    closeModal();
}

function closeModal() { document.getElementById('addCoinModal').classList.remove('active'); }
function save() { localStorage.setItem('cryptoPortfolio', JSON.stringify(portfolio)); }

function renderNews() {
    const container = document.getElementById('newsFeed');
    const fakeNews = [
        { title: "Market bounce: BTC holds support", time: "2m ago" },
        { title: "New ETH upgrade scheduled for Q4", time: "1h ago" },
        { title: "Whale alert: $500M moved to cold wallet", time: "3h ago" }
    ];
    container.innerHTML = fakeNews.map(n => `
        <div class="news-item">
            <div class="news-text">${n.title}</div>
            <div class="news-time">${n.time}</div>
        </div>
    `).join('');
}

function renderGainers() {
    const container = document.getElementById('topGainers');
    const sorted = [...marketData].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h).slice(0, 3);
    container.innerHTML = sorted.map(c => `
        <div class="gainer">
            <span>${c.symbol.toUpperCase()}</span>
            <span class="up">+${c.price_change_percentage_24h?.toFixed(2)}%</span>
        </div>
    `).join('');
}