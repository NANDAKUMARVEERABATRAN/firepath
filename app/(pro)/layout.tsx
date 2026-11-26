import ProGate from "@/components/pro/ProGate";

// Every page in this group (Home, Goals, Portfolio, Plan, Budget, Check-in, Learn, Profile, Score)
// requires an active Pro trial or plan once signed in. The free FIRE calculator lives on "/".
export default function ProLayout({ children }: { children: React.ReactNode }) {
  return <ProGate>{children}</ProGate>;
}
