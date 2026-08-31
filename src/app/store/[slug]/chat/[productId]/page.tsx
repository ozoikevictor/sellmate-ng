import { redirect } from "next/navigation";

type ProductChatPageProps = {
  params: Promise<{
    slug: string;
    productId: string;
  }>;
};

export default async function ProductChatPage({ params }: ProductChatPageProps) {
  const { slug, productId } = await params;
  redirect(`/store/${slug}/chat?product=${encodeURIComponent(productId)}`);
}
