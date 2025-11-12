import { defineFlow, definePrompt, runFlow } from 'genkit/flow';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import * as z from 'zod';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
// スデップ3で作成したクライアント用firebaseインスタンスをインポートします
import { db } from './firebase'; 

// === 1. Define Data Schemas (from docs/backend.json) ===
const ClientSummarySchema = z.object({
  catchphrase: z.string().describe("キャッチフレーズ"),
  merit: z.string().describe("クライアントにとってのメリット"),
  target: z.string().describe("対象者の主な条件"),
  amount: z.string().describe("金額（例：最大250万円）"),
  deadline: z.string().describe("締切（YYYY-MM-DD形式）"),
});

const AccountantSummarySchema = z.object({
  overview: z.string().describe("制度の概要"),
  requirements: z.string().describe("適格要件（詳細）"),
  expenses: z.string().describe("対象経費"),
  pitfalls: z.string().describe("注意点・落とし穴"),
});

const SubsidySchema = z.object({
  id: z.string().describe("Unique identifier"),
  name: z.string().describe("補助金の正式名称"),
  source_url: z.string().url().describe("情報源のURL"),
  deadline: z.string().datetime().describe("締切日時 (ISO 8601)"),
  processed_date: z.string().datetime().describe("処理日時 (ISO 8601)"),
  industry_tags: z.array(z.string()).describe("産業タグ (例: 製造業, IT・情報通信業)"),
  summary_for_client: ClientSummarySchema,
  summary_for_accountant: AccountantSummarySchema,
});

// === 2. Define AI Prompts (Generative AI steps) ===
const clientSummaryPrompt = definePrompt(
  {
    name: 'clientSummary',
    inputSchema: z.object({ url: z.string(), content: z.string() }),
    outputSchema: ClientSummarySchema,
    model: googleAI('gemini-pro'),
    config: {
      temperature: 0.3,
    },
    prompt: (input) => `
      あなたは神奈川県の中小企業を支援するプロのコンサルタントです。
      以下のURLとWebサイト本文を読み、中小企業の経営者が知りたい情報を簡潔にまとめてください。
      URL: ${input.url}
      本文: ${input.content.substring(0, 8000)}
      必ず以下のJSON形式で、日本語で回答してください。
    `,
  },
);

const accountantSummaryPrompt = definePrompt(
  {
    name: 'accountantSummary',
    inputSchema: z.object({ url: z.string(), content: z.string() }),
    outputSchema: AccountantSummarySchema,
    model: googleAI('gemini-pro'),
    config: {
      temperature: 0.1,
    },
    prompt: (input) => `
      あなたは神奈川県の企業を支援する経験豊富な税理士です。
      以下のURLと公募要領の本文を読み、専門家として確認すべき詳細情報を分析・要約してください。
      URL: ${input.url}
      本文: ${input.content.substring(0, 12000)}
      必ず以下のJSON形式で、日本語で回答してください。
    `,
  },
);

const taggingPrompt = definePrompt(
  {
    name: 'tagging',
    inputSchema: z.object({ name: z.string(), content: z.string() }),
    outputSchema: z.object({
      industry_tags: z.array(z.string()).describe("産業タグ (例: 製造業, IT・情報通信業, 全業種対象)"),
    }),
    model: googleAI('gemini-pro'),
    config: {
      temperature: 0.1,
    },
    prompt: (input) => `
      以下の補助金名と本文を読み、対象となる産業タグを付与してください。
      タグは3〜5個程度にし、「全業種対象」も適切に使用してください。
      補助金名: ${input.name}
      本文: ${input.content.substring(0, 5000)}
      必ず以下のJSON形式で回答してください。
    `,
  },
);

// === 3. Define the Main Flow (Orchestration) ===
export const fetchAndProcessSubsidies = defineFlow(
  {
    name: 'fetchAndProcessSubsidies',
    inputSchema: z.void(), // Takes no input
    outputSchema: z.array(SubsidySchema), // Returns an array of processed subsidies
  },
  async () => {
    // Note: This is a placeholder for the "Google Search API"
    const mockSearchResults = [
      {
        name: "神奈川県 ものづくりDX支援補助金 (モック)",
        url: "[https://www.pref.kanagawa.jp/docs/mock/dx-hojo.html](https://www.pref.kanagawa.jp/docs/mock/dx-hojo.html)",
        snippet: "神奈川県内の製造業のDX（デジタルトランスフォーメーション）を支援します。最大250万円...",
        content: "神奈川県 ものづくりDX支援補助金。この補助金は、県内の中小企業が行うIoT、AI導入などのDXの取り組みを支援するものです。対象経費は、ソフトウェア導入費、コンサルティング費用など。適格要件として、県内に事業所を有すること、常時雇用する従業員が5名以上であること。注意点として、他の国・県の補助金との併用は不可。締切は2025年12月31日です。金額は最大250万円（補助率1/2）。対象者は製造業を営む中小企業。"
      },
      {
        name: "神奈川県 IT導入サポート助成金 (モック)",
        url: "[https://www.pref.kanagawa.jp/docs/mock/it-support.html](https://www.pref.kanagawa.jp/docs/mock/it-support.html)",
        snippet: "神奈川県内の全業種の中小企業を対象に、ITツールの導入をサポートします。最大50万円...",
        content: "神奈川県 IT導入サポート助成金。テレワーク導入、ECサイト構築など、IT化を支援。全業種対象。金額は最大50万円（補助率2/3）。締切は2025年11月30日。要件は、県内での事業実態があること。経費はツール利用料、ECサイト構築費など。比較的申請しやすいが、予算上限に達し次第終了となるため注意が必要。"
      }
    ];

    const processedSubsidies: Subsidy[] = [];
    const fs = getFirestore(db.app);

    for (const item of mockSearchResults) {
      console.log(`Processing: ${item.name}`);
      
      const q = query(collection(fs, "subsidies"), where("source_url", "==", item.url));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        console.log(`Skipping duplicate URL: ${item.url}`);
        continue; 
      }
      
      console.log(`Running AI summarization...`);
      const [clientResult, accountantResult, taggingResult] = await Promise.all([
        runFlow(clientSummaryPrompt, { url: item.url, content: item.content }),
        runFlow(accountantSummaryPrompt, { url: item.url, content: item.content }),
        runFlow(taggingPrompt, { name: item.name, content: item.content })
      ]);

      const now = new Date();
      const subsidy: Subsidy = {
        id: doc(collection(fs, "subsidies")).id, 
        name: item.name,
        source_url: item.url,
        deadline: new Date(clientResult.deadline || now).toISOString(),
        processed_date: now.toISOString(),
        industry_tags: taggingResult.industry_tags,
        summary_for_client: clientResult,
        summary_for_accountant: accountantResult,
      };

      console.log(`Saving to Firestore, ID: ${subsidy.id}`);
      const docRef = doc(fs, "subsidies", subsidy.id);
      await setDoc(docRef, subsidy);

      processedSubsidies.push(subsidy);
    }

    console.log(`Processing complete. Added ${processedSubsidies.length} new subsidies.`);
    return processedSubsidies;
  },
);