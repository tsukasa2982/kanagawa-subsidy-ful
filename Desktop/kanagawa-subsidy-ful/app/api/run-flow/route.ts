// ファイルパス: app/api/run-flow/route.ts (修正版・全文)

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    console.log('AIフローの手動実行リクエストを受け付けました。');

    // Genkitフローは同じサーバーの /flows/... エンドポイントで公開されています。
    // localhost と App Hosting が提供する $PORT を使って内部リクエストを送ります。
    
    // PORTが設定されていなければ '3000' を使う（ローカルテスト用）
    const port = process.env.PORT || 3000;
    
    // 呼び出すべきGenkitフローの内部URL
    const flowUrl = `http://localhost:${port}/flows/fetchAndProcessSubsidies`;

    console.log(`トリガーするフローURL: ${flowUrl}`);

    // HTTP POSTリクエストを送信します (完了を待たない "Fire-and-forget")
    // 'fetch' は非同期です
    fetch(flowUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // フローに入力データ（モックデータなど）を渡す場合は
      // body: JSON.stringify({ "inputKey": "inputValue" }) のようにします
      body: JSON.stringify({}), 
    }).then(async (res) => {
      // リクエストが成功したか（200 OKか）
      if (!res.ok) {
        const errorBody = await res.text();
        console.error(`AIフローのバックグラウンド実行でエラーが発生しました (Status: ${res.status}): ${errorBody}`);
      } else {
        console.log('AIフローがバックグラウンドで正常にトリガーされました。');
      }
    }).catch(err => {
      // fetch自体（ネットワークリクエスト）に失敗した場合
      console.error('AIフローのトリガー(fetch)中にエラーが発生しました:', err);
    });

    // フロントエンドには「実行を開始した」とすぐに返事をする
    // （AIの処理には数分かかる可能性があるため）
    return NextResponse.json({ 
      success: true, 
      message: 'AIフローの実行を開始しました。' 
    });

  } catch (err) {
    // もしPOSTリクエストの受け付け自体に失敗した場合
    const errorMessage = (err instanceof Error) ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}