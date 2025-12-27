/**
 * app.js v20 - 統合修正版
 * * 修正内容:
 * 1. URLパラメータ対応 (?tenant=xxx&scene=00007 などで直接開始)
 * 2. アセット管理の移行 (Firebase StorageのURLを自動生成するロジックの追加)
 * 3. UI改善に伴う表示ロジックの整理
 */

console.log("--- app.js v20 (Full Integration) がロードされました ---");

if (typeof firebase === "undefined") {
    alert("致命的エラー: Firebase SDKの読み込みに失敗しました。");
    throw new Error("Firebase SDK is not loaded.");
}

// --- ユーティリティ: アセット管理設定 ---
// Firebase Storage内のパスに基づいてURLを生成します
const ASSET_CONFIG = {
    // あなたのプロジェクトのStorageバケット名に合わせて調整してください
    storageBase: "https://firebasestorage.googleapis.com/v0/b/novel-game-engine.appspot.com/o/",
    
    // キャラクター画像のURL生成 (例: characters/ohara.png)
    getCharacterUrl: (id) => {
        if (!id || id === 'narrator') return "";
        return `${ASSET_CONFIG.storageBase}${encodeURIComponent('characters/' + id + '.png')}?alt=media`;
    },
    
    // 背景画像のURL生成 (例: backgrounds/office.jpg)
    getBgUrl: (id) => {
        if (!id) return "";
        // httpから始まる場合はそのまま、IDの場合はStorageのパスとして扱う
        if (id.startsWith('http')) return id;
        return `${ASSET_CONFIG.storageBase}${encodeURIComponent('backgrounds/' + id + '.jpg')}?alt=media`;
    }
};

async function initializeFirebaseServices() {
    console.log("Debug: initializeFirebaseServices を実行中...");
    try {
        const app = firebase.app();
        const functions = app.functions('us-central1');
        console.log("Debug: FirebaseアプリとFunctionsの初期化に成功しました。");
        return { app, functions };
    } catch (error) {
        console.error("Firebaseサービスの初期化中にエラー:", error);
        alert("致命的エラー: Firebaseサービスの初期化に失敗しました。");
        throw error;
    }
}

async function mainGameInit() {
    const { app, functions } = await initializeFirebaseServices();

    const callFunction = async (functionName, payload) => {
        try {
            const callable = functions.httpsCallable(functionName); 
            const result = await callable(payload);
            return result.data;
        } catch (error) {
            console.error(`Error calling ${functionName}:`, error);
            alert(`APIエラー (${functionName}): ${error.message}`);
            throw error;
        }
    };
    
    let scenario = [];
    let characters = {};
    let currentLine = 0;
    let playerName = "";
    let TENANT_ID = "";

    const el = {
        loading: document.getElementById('loading-overlay'),
        titleScreen: document.getElementById('title-screen'),
        gameContainer: document.getElementById('game-container'),
        dialogueBox: document.getElementById('dialogue-box'),
        dialogueText: document.getElementById('dialogue-text'),
        characterNameBox: document.getElementById('character-name-box'),
        characterContainer: document.getElementById('character-container'),
        imageOverlay: document.getElementById('image-overlay'),
        overlayImage: document.getElementById('overlay-image'),
        startNewBtn: document.getElementById('start-new-button'),
        loadGameBtn: document.getElementById('load-game-button'),
        nameInputContainer: document.getElementById('name-input-container'),
        loadInputContainer: document.getElementById('load-input-container'),
        playerNameInput: document.getElementById('player-name-input'),
        saveCodeInput: document.getElementById('save-code-input'),
        confirmNameBtn: document.getElementById('confirm-name-button'),
        confirmLoadBtn: document.getElementById('confirm-load-button'),
        uiButtons: document.getElementById('ui-buttons'),
        saveBtn: document.getElementById('save-button'),
    };
    
    if (!el.loading || !el.startNewBtn || !el.uiButtons || !el.saveBtn) {
        console.error("必須DOM要素が見つかりません。");
        return;
    }

    function showLoading(text = '読み込み中...') {
        if (el.loading) {
            el.loading.textContent = text;
            el.loading.style.display = 'flex';
        }
    }

    function hideLoading() {
        if (el.loading) el.loading.style.display = 'none';
    }

    // --- URLパラメータの取得ロジック ---
    const getUrlSettings = () => {
        const params = new URLSearchParams(window.location.search);
        return {
            tenant: params.get('tenant') || 'dropshipping',
            scene: params.get('scene') || null // 特定のIDや順序で開始したい場合
        };
    };

    async function init() {
        const settings = getUrlSettings();
        TENANT_ID = settings.tenant;
        console.log(`Setting Tenant: ${TENANT_ID}`);

        showLoading('ゲームデータを同期中...');
        
        try {
            const [scenarioResult, charactersResult] = await Promise.all([
                callFunction('getScenario', { tenantId: TENANT_ID, scenarioName: 'main' }),
                callFunction('getCharacters', { tenantId: TENANT_ID })
            ]);

            if (!scenarioResult || !Array.isArray(scenarioResult.scenario)) throw new Error("シナリオデータが不正です。");
            
            // シナリオのソート
            scenario = scenarioResult.scenario.sort((a, b) => (a.order || 0) - (b.order || 0));
            
            // キャラクターデータのマッピング
            charactersResult.characters.forEach(char => {
                if (!characters[char.characterId]) {
                    characters[char.characterId] = { name: char.characterName, expressions: {} };
                }
                characters[char.characterId].expressions[char.expressionId] = char.imageUrl;
            });

            // URLパラメータで scene が指定されている場合、開始行を特定する
            if (settings.scene) {
                const index = scenario.findIndex(line => 
                    line.id === settings.scene || String(line.order) === settings.scene
                );
                if (index !== -1) {
                    currentLine = index;
                    console.log(`URL指定により行 ${currentLine} から開始します。`);
                }
            }
            
            hideLoading(); 
            console.log(`ロード完了: ${scenario.length} 行`);

        } catch (error) {
            console.error("Init Error:", error);
            hideLoading();
        }
    }

    function startGame() {
        el.titleScreen.style.display = 'none';
        el.dialogueBox.style.display = 'block';
        el.uiButtons.style.display = 'block';
        
        // currentLine は init で設定された値を保持
        processLine();
    }
    
    function processLine() {
        if (scenario.length === 0 || currentLine >= scenario.length) {
            if (scenario.length > 0) alert('おわり');
            return;
        }

        const line = scenario[currentLine];
        const [command, p1, p2, p3, p4] = [line.command, line.param1, line.param2, line.param3, line.param4];
        
        console.log(`Processing Line ${currentLine}: ${command}`);

        switch (command) {
            case 'text':
                const char = characters[p1] || { name: p1 };
                el.characterNameBox.textContent = (p1 === 'narrator') ? '' : char.name.replace('%PLAYER_NAME%', playerName);
                el.dialogueText.innerHTML = p2.replace('%PLAYER_NAME%', playerName);
                
                // アクティブなキャラクターを強調、他を暗く
                document.querySelectorAll('.character').forEach(c => c.classList.add('inactive'));
                const activeCharEl = document.getElementById(`char_${p1}`);
                if (activeCharEl) activeCharEl.classList.remove('inactive');
                
                currentLine++;
                break;

            case 'char_show':
                let charEl = document.getElementById(`char_${p1}`);
                if (!charEl) {
                    charEl = document.createElement('img');
                    charEl.id = `char_${p1}`;
                    charEl.className = 'character';
                    el.characterContainer.appendChild(charEl);
                }
                
                // 1. charactersデータにあるURL優先 2. なければStorageからIDで生成
                const charUrl = (characters[p1] && characters[p1].expressions[p2]) 
                                ? characters[p1].expressions[p2] 
                                : ASSET_CONFIG.getCharacterUrl(p1);
                
                charEl.src = charUrl;
                charEl.className = `character pos-${p3 || 'center'}`;
                currentLine++;
                processLine();
                break;

            case 'char_hide':
                const elToHide = document.getElementById(`char_${p1}`);
                if (elToHide) elToHide.remove();
                currentLine++;
                processLine();
                break;

            case 'bg_change':
                // Storage対応のURL取得
                el.gameContainer.style.backgroundImage = `url(${ASSET_CONFIG.getBgUrl(p1)})`;
                currentLine++;
                processLine();
                break;

            case 'img_show':
                el.overlayImage.src = ASSET_CONFIG.getBgUrl(p1); // 共通ロジックを利用
                el.imageOverlay.style.display = 'flex';
                currentLine++;
                break;

            case 'img_hide':
                el.imageOverlay.style.display = 'none';
                currentLine++;
                processLine();
                break;

            default:
                currentLine++;
                processLine();
                break;
        }
    }

    async function handleSave() {
        const tempLoading = document.createElement('div');
        tempLoading.textContent = 'セーブ中...';
        tempLoading.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.8); color: white; padding: 20px; border-radius: 10px; z-index: 200;';
        document.body.appendChild(tempLoading);

        try {
            const result = await callFunction('saveGame', { 
                tenantId: TENANT_ID, 
                saveData: { playerName, currentLine } 
            });
            tempLoading.remove();
            
            // セーブコード保存処理
            const blob = new Blob([`SaveCode: ${result.saveCode}`], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `save_${TENANT_ID}.txt`;
            a.click();
            alert('セーブ完了');
        } catch (error) { 
            tempLoading.remove();
            alert('セーブ失敗: ' + error.message);
        }
    }
    
    async function handleLoad(saveCode) {
        showLoading('ロード中...');
        try {
            const result = await callFunction('loadGame', { tenantId: TENANT_ID, saveCode: saveCode });
            const sd = result.saveData;
            if (sd) {
                playerName = sd.playerName;
                currentLine = sd.currentLine;
                hideLoading();
                startGame();
            }
        } catch (error) {
            hideLoading();
            alert('データが見つかりません');
        }
    }

    // --- イベントリスナー ---
    el.dialogueBox.addEventListener('click', () => {
        if(el.dialogueBox.style.display !== 'none') processLine();
    });

    el.startNewBtn.addEventListener('click', () => {
        el.startNewBtn.style.display = 'none';
        el.loadGameBtn.style.display = 'none';
        el.nameInputContainer.style.display = 'block';
    });

    el.confirmNameBtn.addEventListener('click', () => {
        playerName = el.playerNameInput.value.trim();
        if (playerName) startGame();
    });

    el.loadGameBtn.addEventListener('click', () => {
        el.startNewBtn.style.display = 'none';
        el.loadGameBtn.style.display = 'none';
        el.loadInputContainer.style.display = 'block';
    });

    el.confirmLoadBtn.addEventListener('click', () => {
        const code = el.saveCodeInput.value.trim();
        if (code) handleLoad(code);
    });
    
    el.saveBtn.addEventListener('click', handleSave);

    // 実行
    init(); 
}

mainGameInit().catch(console.error);