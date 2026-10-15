import { FormSkeleton } from "@/components/skeletons";

export default function Loading() {
  return <div className="mx-auto max-w-xl px-6 py-8"><FormSkeleton fields={5} /></div>;
}
