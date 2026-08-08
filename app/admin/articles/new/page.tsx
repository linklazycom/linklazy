import { ArticleForm } from "@/components/admin/article-form";

export default function NewArticlePage() {
  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-medium">New article</h1>
      <ArticleForm />
    </div>
  );
}
