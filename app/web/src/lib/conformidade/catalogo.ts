/**
 * conformidade/catalogo.ts
 *
 * O QUE FAZ
 * O mapeamento (versionado no código, ADR-063) entre as categorias do OWASP
 * Top 10 2021 — a classificação de toda vulnerabilidade do Vulnera — e os
 * requisitos de três referências:
 *
 *   LGPD ................. Lei 13.709/2018, artigos de segurança e prevenção
 *   ISO/IEC 27001:2022 ... controles do Anexo A (5.x organizacionais, 8.x tecnológicos)
 *   NIST CSF 2.0 ......... subcategorias das funções Identify, Protect e Detect
 *
 * NATUREZA DO MAPEAMENTO
 * É uma REFERÊNCIA DE APOIO: aponta quais requisitos uma classe de falha
 * coloca em risco, para priorizar e conversar com quem cuida da norma. Não é
 * parecer jurídico nem auditoria — a tela diz isso e nunca afirma "conforme";
 * no máximo "sem vulnerabilidade aberta relacionada".
 *
 * Os textos dos requisitos são PARÁFRASES curtas (a norma ISO é paga e o
 * texto oficial não é reproduzido); o identificador é o oficial.
 *
 * QUEM USA
 * `avaliar.ts` (a avaliação contra as vulnerabilidades abertas) e a página
 * de conformidade. Testado em `conformidade.test.ts` (todo requisito tem pelo
 * menos uma categoria, e toda categoria cai em cada referência).
 */

export type ReferenciaId = "LGPD" | "ISO27001" | "NISTCSF";
export type CategoriaOwasp = "A01" | "A02" | "A03" | "A04" | "A05" | "A06" | "A07" | "A08" | "A09" | "A10";

export const CATEGORIAS_OWASP: CategoriaOwasp[] = ["A01", "A02", "A03", "A04", "A05", "A06", "A07", "A08", "A09", "A10"];

export interface Requisito {
  /** Identificador oficial ("Art. 46", "8.28", "PR.PS-06"). */
  id: string;
  titulo: string;
  /** Paráfrase do que o requisito pede. */
  resumo: string;
  /** Agrupamento da própria referência (capítulo, tema do Anexo A, função do CSF). */
  grupo: string;
  categorias: CategoriaOwasp[];
}

export interface Referencia {
  id: ReferenciaId;
  nome: string;
  versao: string;
  descricao: string;
  requisitos: Requisito[];
}

export const REFERENCIAS: Referencia[] = [
  {
    id: "LGPD",
    nome: "LGPD",
    versao: "Lei 13.709/2018",
    descricao: "Segurança e prevenção no tratamento de dados pessoais.",
    requisitos: [
      {
        id: "Art. 6º, VII",
        titulo: "Princípio da segurança",
        resumo: "Usar medidas técnicas e administrativas que protejam os dados pessoais de acessos não autorizados e de incidentes.",
        grupo: "Princípios",
        categorias: ["A01", "A02", "A03", "A05", "A07", "A10"],
      },
      {
        id: "Art. 6º, VIII",
        titulo: "Princípio da prevenção",
        resumo: "Adotar medidas para prevenir danos em razão do tratamento de dados pessoais.",
        grupo: "Princípios",
        categorias: ["A04", "A06", "A08"],
      },
      {
        id: "Art. 46",
        titulo: "Medidas de segurança",
        resumo: "Medidas de segurança aptas a proteger os dados de acessos não autorizados e de destruição, perda, alteração ou difusão indevidas.",
        grupo: "Segurança e sigilo",
        categorias: ["A01", "A02", "A03", "A05", "A06", "A07", "A08", "A10"],
      },
      {
        id: "Art. 46, § 2º",
        titulo: "Segurança desde a concepção",
        resumo: "As medidas de segurança devem ser observadas desde a fase de concepção do produto ou serviço até a sua execução.",
        grupo: "Segurança e sigilo",
        categorias: ["A04", "A08"],
      },
      {
        id: "Art. 48",
        titulo: "Comunicação de incidente",
        resumo: "Comunicar à ANPD e ao titular incidente que possa causar risco ou dano relevante — o que exige detectá-lo.",
        grupo: "Segurança e sigilo",
        categorias: ["A09"],
      },
      {
        id: "Art. 49",
        titulo: "Sistemas seguros",
        resumo: "Os sistemas usados no tratamento devem ser estruturados para atender aos requisitos de segurança e aos padrões de boas práticas.",
        grupo: "Segurança e sigilo",
        categorias: ["A02", "A04", "A05", "A06"],
      },
    ],
  },
  {
    id: "ISO27001",
    nome: "ISO/IEC 27001",
    versao: "2022 — Anexo A",
    descricao: "Controles de segurança da informação do Anexo A.",
    requisitos: [
      { id: "5.15", titulo: "Controle de acesso", resumo: "Regras de acesso físico e lógico a informações e ativos, com base nos requisitos do negócio.", grupo: "Organizacionais", categorias: ["A01"] },
      { id: "5.17", titulo: "Informação de autenticação", resumo: "Alocação e gestão de senhas e outros segredos de autenticação.", grupo: "Organizacionais", categorias: ["A07"] },
      { id: "5.21", titulo: "Segurança na cadeia de suprimentos de TIC", resumo: "Gerir os riscos de produtos e serviços de terceiros, inclusive componentes de software.", grupo: "Organizacionais", categorias: ["A06", "A08"] },
      { id: "8.3", titulo: "Restrição de acesso à informação", resumo: "Restringir o acesso a informações conforme a política de controle de acesso.", grupo: "Tecnológicos", categorias: ["A01"] },
      { id: "8.5", titulo: "Autenticação segura", resumo: "Tecnologias e procedimentos de autenticação segura.", grupo: "Tecnológicos", categorias: ["A07"] },
      { id: "8.8", titulo: "Gestão de vulnerabilidades técnicas", resumo: "Obter informação sobre vulnerabilidades, avaliar a exposição e agir.", grupo: "Tecnológicos", categorias: ["A06"] },
      { id: "8.9", titulo: "Gestão de configuração", resumo: "Estabelecer, documentar e monitorar configurações seguras.", grupo: "Tecnológicos", categorias: ["A05"] },
      { id: "8.15", titulo: "Registros (logging)", resumo: "Produzir, guardar, proteger e analisar registros de atividades e eventos.", grupo: "Tecnológicos", categorias: ["A09"] },
      { id: "8.16", titulo: "Monitoramento de atividades", resumo: "Monitorar redes, sistemas e aplicações em busca de comportamento anômalo.", grupo: "Tecnológicos", categorias: ["A09"] },
      { id: "8.20", titulo: "Segurança de redes", resumo: "Proteger redes e dispositivos de rede, inclusive contra acessos originados das aplicações.", grupo: "Tecnológicos", categorias: ["A10"] },
      { id: "8.24", titulo: "Uso de criptografia", resumo: "Regras para o uso efetivo de criptografia e gestão de chaves.", grupo: "Tecnológicos", categorias: ["A02"] },
      { id: "8.25", titulo: "Ciclo de desenvolvimento seguro", resumo: "Regras para o desenvolvimento seguro de software e sistemas.", grupo: "Tecnológicos", categorias: ["A04", "A08"] },
      { id: "8.26", titulo: "Requisitos de segurança de aplicações", resumo: "Identificar e aprovar requisitos de segurança ao desenvolver ou adquirir aplicações.", grupo: "Tecnológicos", categorias: ["A03", "A04"] },
      { id: "8.27", titulo: "Arquitetura e engenharia de sistemas seguros", resumo: "Princípios de engenharia segura aplicados ao projeto de sistemas.", grupo: "Tecnológicos", categorias: ["A04"] },
      { id: "8.28", titulo: "Codificação segura", resumo: "Princípios de codificação segura no desenvolvimento de software.", grupo: "Tecnológicos", categorias: ["A03", "A10"] },
      { id: "8.29", titulo: "Testes de segurança no desenvolvimento e aceite", resumo: "Processos de teste de segurança no ciclo de desenvolvimento.", grupo: "Tecnológicos", categorias: ["A03", "A05"] },
      { id: "8.32", titulo: "Gestão de mudanças", resumo: "Mudanças em sistemas e recursos de processamento sujeitas a procedimentos de controle.", grupo: "Tecnológicos", categorias: ["A08"] },
    ],
  },
  {
    id: "NISTCSF",
    nome: "NIST CSF",
    versao: "2.0",
    descricao: "Subcategorias das funções Identify (ID), Protect (PR) e Detect (DE).",
    requisitos: [
      { id: "ID.RA-01", titulo: "Vulnerabilidades identificadas", resumo: "Vulnerabilidades nos ativos são identificadas, validadas e registradas.", grupo: "Identify", categorias: ["A06"] },
      { id: "PR.AA-01", titulo: "Identidades e credenciais", resumo: "Identidades e credenciais de usuários, serviços e hardware autorizados são gerenciadas.", grupo: "Protect", categorias: ["A07"] },
      { id: "PR.AA-03", titulo: "Autenticação", resumo: "Usuários, serviços e hardware são autenticados.", grupo: "Protect", categorias: ["A07"] },
      { id: "PR.AA-05", titulo: "Permissões e menor privilégio", resumo: "Permissões são definidas, aplicadas e revisadas, com menor privilégio e segregação de funções.", grupo: "Protect", categorias: ["A01"] },
      { id: "PR.DS-01", titulo: "Dados em repouso", resumo: "Confidencialidade, integridade e disponibilidade dos dados em repouso são protegidas.", grupo: "Protect", categorias: ["A02", "A08"] },
      { id: "PR.DS-02", titulo: "Dados em trânsito", resumo: "Confidencialidade, integridade e disponibilidade dos dados em trânsito são protegidas.", grupo: "Protect", categorias: ["A02"] },
      { id: "PR.PS-01", titulo: "Gestão de configuração", resumo: "Práticas de gestão de configuração são estabelecidas e aplicadas.", grupo: "Protect", categorias: ["A05"] },
      { id: "PR.PS-02", titulo: "Software mantido", resumo: "Software é mantido, substituído e removido de acordo com o risco.", grupo: "Protect", categorias: ["A06"] },
      { id: "PR.PS-04", titulo: "Registros gerados", resumo: "Registros de log são gerados e disponibilizados para monitoramento contínuo.", grupo: "Protect", categorias: ["A09"] },
      { id: "PR.PS-06", titulo: "Desenvolvimento seguro", resumo: "Práticas de desenvolvimento seguro integradas e acompanhadas ao longo do ciclo de vida.", grupo: "Protect", categorias: ["A03", "A04", "A08"] },
      { id: "PR.IR-01", titulo: "Proteção contra acesso lógico indevido", resumo: "Redes e ambientes são protegidos contra acesso e uso lógico não autorizados.", grupo: "Protect", categorias: ["A10"] },
      { id: "DE.CM-09", titulo: "Monitoramento de software e dados", resumo: "Hardware, software, ambientes de execução e seus dados são monitorados para achar eventos adversos.", grupo: "Detect", categorias: ["A09"] },
    ],
  },
];
