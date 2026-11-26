/**
 * conteudo.test.tsx
 *
 * O QUE FAZ
 * Confere o conteúdo que a landing promete hoje: o que o produto faz (Recursos),
 * o que ele NÃO faz (limites do DAST, ausência de IA, sem fidelidade), os
 * preços, as perguntas frequentes, a comparação e os quatro passos.
 *
 * POR QUE EXISTE
 * A landing é a vitrine do produto. Texto que promete o que o código não faz
 * (IA fora do MVP, suporte e SLA que não existem, prazo de correção sem
 * implementação) é um defeito comercial, não de estilo. Estes testes travam o
 * texto conferido em 2026-11-15 contra a volta de promessas removidas.
 *
 * COMO
 * Renderiza cada seção isolada, sem a página inteira e sem WebGL. Usa o setup
 * global (`src/test/setup.ts`); o GSAP de "Como funciona" roda de verdade em
 * jsdom, como nos demais testes de movimento da landing.
 *
 *   CONT-01  Recursos: heading novo, três grupos e os nove títulos de card
 *   CONT-02  Recursos não menciona IA (fora do MVP, ADR-017)
 *   CONT-03  Recursos diz o limite do DAST: não ataca, não envia formulários,
 *            não faz login
 *   CONT-04  Planos: os três preços continuam; sem IA, suporte prioritário nem SLA dedicado
 *   CONT-05  FAQ: perguntas de escopo presentes; perguntas sobre troca de plano
 *            e fidelidade fora
 *   CONT-06  Comparação: sem prazo de 1 dia útil nem revalidação; "Pentest, DAST,
 *            SAST e SCA na mesma tela" presente
 *   CONT-07  Como funciona: os quatro passos CONTRATE, CADASTRE, ENCONTRE, CORRIJA
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Features from "./features";
import FAQ from "./faq";
import Pricing from "./pricing";
import Comparison from "./comparison";
import HowItWorks from "./how-it-works";

describe("Recursos", () => {
  it("CONT-01 — heading novo, três grupos e os nove títulos de card", () => {
    render(<Features />);
    expect(screen.getByRole("heading", { name: "O que o Vulnera faz hoje" })).toBeInTheDocument();
    for (const grupo of ["ENCONTRAR", "ORGANIZAR", "CORRIGIR E PROVAR"]) {
      expect(screen.getByRole("heading", { name: grupo, level: 3 })).toBeInTheDocument();
    }
    const titulos = [
      "Scanner DAST com OWASP ZAP",
      "Importação SAST e SCA",
      "Threat Intel",
      "Visão unificada por aplicação",
      "Exposure Graph",
      "CVSS com override auditado",
      "Remediação com prazo",
      "Relatório PDF e planilha Excel",
      "Maturidade de segurança",
    ];
    for (const titulo of titulos) {
      expect(screen.getByRole("heading", { name: titulo, level: 4 }), titulo).toBeInTheDocument();
    }
  });

  it("CONT-02 — não menciona IA", () => {
    const { container } = render(<Features />);
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(/\bIA\b/);
    expect(texto).not.toContain("IA para Findings");
  });

  it("CONT-03 — diz o limite do DAST: não ataca, não envia formulários, não faz login", () => {
    const { container } = render(<Features />);
    const texto = container.textContent ?? "";
    expect(texto).toContain("não ataca");
    expect(texto).toContain("não envia formulários");
    expect(texto).toContain("não faz login");
  });
});

describe("Planos", () => {
  it("CONT-04 — os três preços continuam, sem IA, suporte prioritário nem SLA dedicado", () => {
    const { container } = render(<MemoryRouter><Pricing /></MemoryRouter>);
    for (const preco of ["R$ 499/mês", "R$ 1.499/mês", "Sob consulta"]) {
      expect(screen.getByText(preco)).toBeInTheDocument();
    }
    const itens = Array.from(container.querySelectorAll("li")).map((li) => li.textContent ?? "");
    expect(itens.length).toBeGreaterThan(0);
    for (const item of itens) {
      expect(item).not.toMatch(/\bIA\b/);
    }
    const texto = container.textContent ?? "";
    expect(texto).not.toContain("Suporte prioritário");
    expect(texto).not.toContain("SLA dedicado");
  });
});

describe("Perguntas frequentes", () => {
  it("CONT-05 — perguntas de escopo presentes; troca de plano e fidelidade fora", () => {
    const { container } = render(<FAQ />);
    expect(screen.getByRole("button", { name: "O scanner ataca a minha aplicação?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "O Vulnera usa IA?" })).toBeInTheDocument();
    const texto = container.textContent ?? "";
    expect(texto).not.toContain("Posso trocar de plano depois?");
    expect(texto).not.toContain("Preciso de contrato de fidelidade?");
  });
});

describe("Comparação", () => {
  it("CONT-06 — sem prazo de 1 dia útil nem revalidação; origem dos achados na mesma tela", () => {
    const { container } = render(<Comparison />);
    const texto = container.textContent ?? "";
    expect(texto).not.toContain("1 dia útil");
    expect(texto).not.toMatch(/revalida/i);
    expect(screen.getByText("Pentest, DAST, SAST e SCA na mesma tela")).toBeInTheDocument();
  });
});

describe("Como funciona", () => {
  it("CONT-07 — os quatro passos na ordem: CONTRATE, CADASTRE, ENCONTRE, CORRIJA", () => {
    render(<HowItWorks />);
    const passos = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(passos).toEqual(["CONTRATE", "CADASTRE", "ENCONTRE", "CORRIJA"]);
  });
});
