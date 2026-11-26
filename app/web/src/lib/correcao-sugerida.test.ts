/**
 * correcao-sugerida.test.ts — correção sugerida sem IA (ADR-063).
 *   COR-01  purl e ecossistema
 *   COR-02  versão sugerida: menor corrigida na mesma major, acima da atual
 *   COR-03  comando e manifesto por ecossistema
 *   COR-04  links: só advisory conhecido e referência http(s)
 */

import { describe, expect, it } from "vitest";
import { escolherVersaoCorrigida, lerPurl, linkDoAdvisory, linkSeguro, montarCorrecao, normalizarEcossistema } from "./correcao-sugerida";

describe("correção sugerida", () => {
  it("COR-01 — lê o purl", () => {
    expect(lerPurl("pkg:npm/lodash@4.17.15")).toEqual({ ecossistema: "npm", nome: "lodash" });
    expect(lerPurl("pkg:npm/%40babel/core@7.0.0")).toEqual({ ecossistema: "npm", nome: "@babel/core" });
    expect(lerPurl("pkg:maven/org.apache.logging.log4j/log4j-core@2.14.1")).toEqual({ ecossistema: "maven", nome: "org.apache.logging.log4j/log4j-core" });
    expect(lerPurl("não é purl").ecossistema).toBeNull();
    expect(normalizarEcossistema("PyPI")).toBe("pypi");
    expect(normalizarEcossistema("crates.io")).toBe("cargo");
  });

  it("COR-02 — escolhe a versão", () => {
    expect(escolherVersaoCorrigida("2.14.1", "2.15.0, 2.12.2")).toBe("2.15.0");
    expect(escolherVersaoCorrigida("2.11.0", "2.12.2, 2.15.0, 3.0.1")).toBe("2.12.2");
    expect(escolherVersaoCorrigida("1.2.0", ">=3.0.1, 4.0.0")).toBe("3.0.1"); // sem a mesma major
    expect(escolherVersaoCorrigida(null, "1.5.0, 1.2.0")).toBe("1.2.0");
    expect(escolherVersaoCorrigida("1.0.0", "sem correção")).toBeNull();
    expect(escolherVersaoCorrigida("1.0.0", null)).toBeNull();
  });

  it("COR-03 — comando e manifesto por ecossistema", () => {
    expect(montarCorrecao({ ecossistema: "npm", pacote: "lodash", versaoAtual: "4.17.15", versoesCorrigidas: "4.17.21" })).toMatchObject({
      comando: "npm install lodash@^4.17.21",
      manifesto: { arquivo: "package.json", trecho: '"lodash": "^4.17.21"' },
    });
    const maven = montarCorrecao({ ecossistema: "maven", pacote: "org.apache.logging.log4j/log4j-core", versaoAtual: "2.14.1", versoesCorrigidas: "2.15.0, 2.12.2" })!;
    expect(maven.comando).toBe("mvn versions:use-dep-version -Dincludes=org.apache.logging.log4j:log4j-core -DdepVersion=2.15.0");
    expect(maven.manifesto.trecho).toContain("<artifactId>log4j-core</artifactId>");
    expect(montarCorrecao({ ecossistema: "pypi", pacote: "django", versaoAtual: "3.2.0", versoesCorrigidas: "3.2.19" })!.comando).toBe('pip install "django>=3.2.19"');
    expect(montarCorrecao({ ecossistema: "golang", pacote: "golang.org/x/net", versaoAtual: "0.7.0", versoesCorrigidas: "0.17.0" })!.comando).toBe("go get golang.org/x/net@v0.17.0 && go mod tidy");
    expect(montarCorrecao({ ecossistema: "npm", pacote: "x", versaoAtual: "1.0.0", versoesCorrigidas: null })).toBeNull();
  });

  it("COR-04 — links seguros", () => {
    expect(linkDoAdvisory("cve-2021-44228")).toBe("https://nvd.nist.gov/vuln/detail/CVE-2021-44228");
    expect(linkDoAdvisory("GHSA-jfh8-c2jp-5v3q")).toBe("https://github.com/advisories/GHSA-jfh8-c2jp-5v3q");
    expect(linkDoAdvisory("javascript:alert(1)")).toBeNull();
    expect(linkSeguro("javascript:alert(1)")).toBeNull();
    expect(linkSeguro("https://semgrep.dev/r/x")).toBe("https://semgrep.dev/r/x");
  });
});
