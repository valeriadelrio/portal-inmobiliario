import { Bone, SearchSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-6 py-8">
      <Bone className="h-8 w-80 max-w-full" />
      <SearchSkeleton />
    </div>
  );
}
