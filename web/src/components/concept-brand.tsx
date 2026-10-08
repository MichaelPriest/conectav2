import Link from 'next/link';
export function ConceptBrand({ href = '/', light = false }: { href?:string; light?:boolean }) {
  return <Link href={href} className={'concept-brand' + (light?' concept-brand-light':'')} aria-label="Conecta — início">
    <span className="concept-brand-symbol" aria-hidden="true">C<span className="concept-brand-dot"/></span>
    <span>conecta</span>
  </Link>;
}
