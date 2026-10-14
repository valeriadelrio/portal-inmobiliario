import { FormSkeleton } from "@/components/skeletons";

export default function Loading() {
  return <div className="mx-auto max-w-4xl px-6 py-8"><FormSkeleton fields={8} /></div>;
}
