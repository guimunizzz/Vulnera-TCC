/**
 * Uniformiza a representação do CNPJ na adesão e no cadastro empresarial.
 * A forma mascarada permanece consultável para preservar empresas legadas.
 */
const canonicalPattern = /^[0-9]{14}$/u;
const maskedPattern = /^([0-9]{2})\.([0-9]{3})\.([0-9]{3})\/([0-9]{4})-([0-9]{2})$/u;

export function normalizeCompanyCnpj(value: string): string | null {
  const cnpj = value.trim();
  if (canonicalPattern.test(cnpj)) return cnpj;
  const masked = maskedPattern.exec(cnpj);
  return masked ? masked.slice(1).join("") : null;
}

export function companyCnpjVariants(canonical: string): string[] {
  const masked = canonical.replace(/^([0-9]{2})([0-9]{3})([0-9]{3})([0-9]{4})([0-9]{2})$/u, "$1.$2.$3/$4-$5");
  return masked === canonical ? [canonical] : [canonical, masked];
}
