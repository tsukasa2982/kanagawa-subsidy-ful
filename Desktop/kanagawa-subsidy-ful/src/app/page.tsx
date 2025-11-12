// This "use client" directive is essential for components that use React hooks like useState and useEffect.
// Our page component fetches data from Firestore on the client side, so it must be a client component.
"use client";

import { useState, useEffect } from "react";
// Import the 'db' instance we configured in lib/firebase.ts
import { db } from "@/lib/firebase"; 
// Import Firestore functions to query the database
import { collection, onSnapshot, QuerySnapshot, DocumentData } from "firebase/firestore";
// Import the 'cn' utility function we created in lib/utils.ts
import { cn } from "@/lib/utils";
// Import icons for the UI
import { Building, Target, CheckCircle, AlertTriangle, DollarSign, Calendar, ChevronDown, Info } from "lucide-react";

// --- Data Type Definition ---
// Define the TypeScript type for our Subsidy data, based on docs/backend.json
// This ensures our component uses data correctly.
type Subsidy = {
  id: string; // The document ID from Firestore
  name: string;
  source_url: string;
  deadline: string;
  processed_date: string;
  industry_tags: string[];
  summary_for_client: {
    catchphrase: string;
    merit: string;
    target: string;
    amount: string;
    deadline: string;
  };
  summary_for_accountant: {
    overview: string;
    requirements: string;
    expenses: string;
    pitfalls: string;
  };
};

// --- shadcn/ui Placeholder Components ---
// Since we can't run `npx shadcn-ui add`, we create simple placeholders
// that use the same props and apply Tailwind styling.

const Card = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
);

const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
);

const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight font-display", // Use display font
      className
    )}
    {...props}
  />
);

const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-6 pt-0", className)} {...props} />
);

const Badge = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
      className
    )}
    {...props}
  />
);

// We need to build a basic Accordion from scratch
const Accordion = ({ children }: { children: React.ReactNode }) => (
  <div className="w-full">{children}</div>
);

const AccordionItem = ({ value, children }: { value: string, children: React.ReactNode }) => (
  <div className="border-b">{children}</div>
);

// This component will manage its own open/close state
const AccordionTrigger = ({ children }: { children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  // Find the content to show/hide. This is a simple way to link trigger and content.
  const content = (Array.isArray(children) ? children : [children]).find(
    (child) => (child as React.ReactElement)?.type === AccordionContent
  );
  const triggerText = (Array.isArray(children) ? children : [children]).find(
    (child) => (child as React.ReactElement)?.type !== AccordionContent
  );

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180"
        data-state={isOpen ? "open" : "closed"}
      >
        {triggerText}
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 transition-transform duration-200", isOpen && "rotate-180")}
        />
      </button>
      {isOpen && content}
    </div>
  );
};

const AccordionContent = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <div className={cn("overflow-hidden text-sm transition-all pb-4 pt-0", className)}>
    {children}
  </div>
);


// --- Main Page Component ---

export default function HomePage() {
  // State to store the list of subsidies fetched from Firestore
  const [subsidies, setSubsidies] = useState<Subsidy[]>([]);
  // State to show a loading message while data is being fetched
  const [loading, setLoading] = useState(true);
  // State for potential errors during data fetching
  const [error, setError] = useState<string | null>(null);

  // useEffect hook runs after the component mounts
  useEffect(() => {
    // Set up the Firestore query for the '/subsidies' collection
    // This path matches our docs/backend.json definition
    const q = collection(db, "subsidies");

    // onSnapshot creates a real-time listener.
    // The code inside will run every time the data in the '/subsidies' collection changes.
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot: QuerySnapshot) => {
        // This is triggered when data is fetched or updated
        const subsidiesData: Subsidy[] = [];
        querySnapshot.forEach((doc: DocumentData) => {
          // Combine the document data with its unique ID
          subsidiesData.push({ id: doc.id, ...doc.data() } as Subsidy);
        });
        
        // Sort subsidies by deadline, most recent first (optional)
        subsidiesData.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

        // Update the component's state with the new data
        setSubsidies(subsidiesData);
        // Hide the loading message
        setLoading(false);
      },
      (err) => {
        // This is triggered if the listener fails
        console.error("Error fetching subsidies: ", err);
        setError("補助金データの読み込みに失敗しました。");
        setLoading(false);
      }
    );

    // Cleanup function: This runs when the component is unmounted
    // It's crucial to prevent memory leaks by unsubscribing from the listener.
    return () => unsubscribe();
  }, []); // The empty dependency array [] means this effect runs only once on mount

  // --- Helper Component for displaying info with an icon ---
  const InfoItem = ({ icon: Icon, label, children }: { icon: React.ElementType, label: string, children: React.ReactNode }) => (
    <div className="flex items-start space-x-3">
      <Icon className="h-5 w-5 flex-shrink-0 text-primary/80 mt-1" />
      <div className="flex-1">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="text-base font-body">{children}</p>
      </div>
    </div>
  );

  // --- Render Logic ---
  return (
    <main
      className="flex min-h-screen flex-col items-center p-4 sm:p-12 md:p-24"
      style={{ backgroundColor: "#F0F2F5" }} // Use background color from design guide
    >
      <div className="w-full max-w-4xl">
        {/* --- Header Section --- */}
        <header className="mb-12 text-center">
          <h1 
            className="text-5xl md:text-6xl font-display font-bold"
            style={{ color: "#2E3192" }} // Use primary color from design guide
          >
            Kanagawa Subsidy Navigator
          </h1>
          <p className="mt-4 text-lg text-gray-700 font-body">
            神奈川県の補助金・助成金情報をAIが要約してナビゲートします。
          </p>
        </header>

        {/* --- Content Section --- */}
        <div className="space-y-8">
          {/* Handle Loading state */}
          {loading && (
            <div className="text-center text-primary">
              <Info className="h-8 w-8 mx-auto animate-spin mb-2" />
              <p className="font-semibold">最新の補助金情報を読み込んでいます...</p>
            </div>
          )}

          {/* Handle Error state */}
          {error && (
            <div className="text-center text-red-600 bg-red-100 p-4 rounded-lg">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
              <p className="font-semibold">{error}</p>
            </div>
          )}

          {/* Handle No Data state */}
          {!loading && !error && subsidies.length === 0 && (
            <div className="text-center text-gray-500 bg-white p-8 rounded-lg shadow-sm">
              <Info className="h-8 w-8 mx-auto mb-2" />
              <p className="font-semibold">現在、利用可能な補助金情報はありません。</p>
              <p className="text-sm">AIが新しい情報を収集中です。</p>
            </div>
          )}

          {/* Render Subsidy List */}
          {!loading && !error && subsidies.length > 0 && (
            subsidies.map((subsidy) => (
              <Card key={subsidy.id} className="w-full overflow-hidden shadow-lg">
                <CardHeader>
                  <CardTitle className="text-primary" style={{ color: "#2E3192" }}>
                    {subsidy.name}
                  </CardTitle>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {subsidy.industry_tags.map((tag) => (
                      <Badge
                        key={tag}
                        className="bg-accent text-accent-foreground"
                        style={{ backgroundColor: "#FFC13B", color: "#333" }} // Use accent color
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* --- Client Summary (Visible by default) --- */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold font-display text-primary">
                      クライアント向け要約
                    </h4>
                    <InfoItem icon={CheckCircle} label="メリット">
                      {subsidy.summary_for_client.merit}
                    </InfoItem>
                    <InfoItem icon={Target} label="対象者">
                      {subsidy.summary_for_client.target}
                    </InfoItem>
                    <InfoItem icon={DollarSign} label="金額">
                      {subsidy.summary_for_client.amount}
                    </InfoItem>
                    <InfoItem icon={Calendar} label="締切">
                      {subsidy.summary_for_client.deadline}
                    </InfoItem>
                  </div>

                  {/* --- Accountant Summary (Collapsible) --- */}
                  <Accordion>
                    <AccordionItem value="accountant-summary">
                      <AccordionTrigger>
                        <span className="text-lg font-semibold font-display text-gray-700 hover:text-primary">
                          税理士向け詳細（専門家向け）
                        </span>
                        <AccordionContent>
                          <div className="space-y-4 pt-4">
                            <InfoItem icon={Info} label="概要">
                              {subsidy.summary_for_accountant.overview}
                            </InfoItem>
                            <InfoItem icon={Building} label="主な要件">
                              {subsidy.summary_for_accountant.requirements}
                            </InfoItem>
                            <InfoItem icon={DollarSign} label="対象経費">
                              {subsidy.summary_for_accountant.expenses}
                            </InfoItem>
                            <InfoItem icon={AlertTriangle} label="注意点・落とし穴">
                              {subsidy.summary_for_accountant.pitfalls}
                            </InfoItem>
                          </div>
                        </AccordionContent>
                      </AccordionTrigger>
                    </AccordionItem>
                  </Accordion>

                  {/* --- Source URL --- */}
                  <div className="border-t pt-4">
                     <a
                      href={subsidy.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      公式情報（外部リンク）
                    </a>
                  </div>

                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </main>
  );
}