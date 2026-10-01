/**
 * finding-query.test.ts
 *
 * Testes do parser do query wizard. Cobre cada operador, múltiplos valores,
 * texto livre misturado com filtro, cada tipo de erro, ida e volta de
 * serialização, e acento/caixa.
 *
 * 🎯 O invariante mais importante deste arquivo é o último bloco: NENHUMA
 * entrada, por pior que seja, pode lançar. A barra é reparsada a cada tecla.
 */

import { describe, expect, it } from "vitest";
import {
  analisarContexto,
  aplicarSugestao,
  camposUsados,
  parseQuery,
  paramsToTokens,
  tokensToParams,
  tokensToString,
  tokenLabel,
  type QueryToken,
} from "./finding-query";

/** Só os filtros, sem o token de texto — facilita as asserções. */
const filtros = (tokens: QueryToken[]) => tokens.filter((t) => t.kind === "filter");

describe("parseQuery — operadores", () => {
  it("igual com um valor", () => {
    const tokens = parseQuery("severidade = HIGH");

    expect(tokens).toEqual([
      { kind: "filter", field: "severidade", operator: "=", values: ["HIGH"], raw: "severidade = HIGH" },
    ]);
  });

  it("igual com vários valores é OR dentro do campo", () => {
    const tokens = parseQuery("severidade = HIGH, CRITICAL");

    expect(filtros(tokens)).toHaveLength(1);
    expect(tokens[0]).toMatchObject({ field: "severidade", operator: "=", values: ["HIGH", "CRITICAL"] });
  });

  it("diferente", () => {
    const tokens = parseQuery("status != CLOSED");

    expect(tokens[0]).toMatchObject({ field: "status", operator: "!=", values: ["CLOSED"] });
  });

  it("contém, em campo de texto", () => {
    const tokens = parseQuery("titulo ~ injection");

    expect(tokens[0]).toMatchObject({ field: "titulo", operator: "~", values: ["injection"] });
  });

  it("dois-pontos vale como igual", () => {
    expect(parseQuery("severidade: HIGH")[0]).toMatchObject({ operator: "=", values: ["HIGH"] });
  });

  it("aceita as três formas de espaçamento em volta do operador", () => {
    const colado = parseQuery("severidade=HIGH");
    const meio = parseQuery("severidade= HIGH");
    const solto = parseQuery("severidade = HIGH");

    for (const t of [colado, meio, solto]) {
      expect(t[0]).toMatchObject({ kind: "filter", field: "severidade", operator: "=", values: ["HIGH"] });
    }
  });
});

describe("parseQuery — combinação", () => {
  it("o exemplo do enunciado produz exatamente 2 tokens", () => {
    const tokens = parseQuery("severidade = HIGH, CRITICAL status != CLOSED");

    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toMatchObject({ field: "severidade", operator: "=", values: ["HIGH", "CRITICAL"] });
    expect(tokens[1]).toMatchObject({ field: "status", operator: "!=", values: ["CLOSED"] });
  });

  it("AND explícito é separador, não texto de busca", () => {
    const comAnd = parseQuery("severidade = HIGH AND status = OPEN");
    const semAnd = parseQuery("severidade = HIGH status = OPEN");

    expect(comAnd).toHaveLength(2);
    expect(comAnd.some((t) => t.kind === "text")).toBe(false);
    expect(tokensToString(comAnd)).toBe(tokensToString(semAnd));
  });

  it("texto livre misturado com filtro vira um token de texto só", () => {
    const tokens = parseQuery("sql injection severidade = HIGH");

    expect(filtros(tokens)).toHaveLength(1);
    const texto = tokens.find((t) => t.kind === "text");
    expect(texto).toMatchObject({ kind: "text", value: "sql injection" });
  });

  it("texto livre sozinho vira busca", () => {
    expect(parseQuery("sql injection")).toEqual([{ kind: "text", value: "sql injection", raw: "sql injection" }]);
  });

  it("entrada vazia ou só espaços não produz token", () => {
    expect(parseQuery("")).toEqual([]);
    expect(parseQuery("    ")).toEqual([]);
  });

  it("aspas preservam o espaço dentro do valor", () => {
    const tokens = parseQuery('projeto = "Portal E-commerce"');

    expect(tokens[0]).toMatchObject({ field: "projeto", operator: "=", values: ["Portal E-commerce"] });
  });
});

describe("parseQuery — acento e caixa", () => {
  it("o campo aceita com e sem acento", () => {
    expect(parseQuery("aplicacao = x")[0]).toMatchObject({ field: "aplicacao" });
    expect(parseQuery("aplicação = x")[0]).toMatchObject({ field: "aplicacao" });
  });

  it("o campo aceita caixa alta", () => {
    expect(parseQuery("SEVERIDADE = HIGH")[0]).toMatchObject({ field: "severidade" });
    expect(parseQuery("Severidade = HIGH")[0]).toMatchObject({ field: "severidade" });
  });

  it("o valor de enum é normalizado para a forma canônica", () => {
    expect(parseQuery("severidade = high")[0]).toMatchObject({ values: ["HIGH"] });
    expect(parseQuery("status = in_progress")[0]).toMatchObject({ values: ["IN_PROGRESS"] });
    expect(parseQuery("owasp = a03")[0]).toMatchObject({ values: ["A03"] });
  });

  it("apelidos em inglês funcionam", () => {
    expect(parseQuery("severity = HIGH")[0]).toMatchObject({ field: "severidade" });
    expect(parseQuery("company = x")[0]).toMatchObject({ field: "empresa" });
  });
});

describe("parseQuery — erros", () => {
  it("campo desconhecido", () => {
    const [token] = parseQuery("gravidade = HIGH");

    expect(token).toMatchObject({ kind: "invalid" });
    expect((token as { reason: string }).reason).toContain("campo desconhecido");
  });

  it("valor de enum inexistente", () => {
    const [token] = parseQuery("severidade = URGENTE");

    expect(token!.kind).toBe("invalid");
    expect((token as { reason: string }).reason).toContain("URGENTE");
  });

  it("um valor ruim invalida a expressão inteira, não só ele", () => {
    const [token] = parseQuery("severidade = HIGH, URGENTE");

    // Descartar só o valor ruim mostraria a lista de HIGH sem avisar que
    // metade do que foi pedido não valeu.
    expect(token!.kind).toBe("invalid");
  });

  it("campo sem valor", () => {
    const [token] = parseQuery("severidade =");

    expect(token).toMatchObject({ kind: "invalid" });
    expect((token as { reason: string }).reason).toContain("sem valor");
  });

  it("aspas não fechadas", () => {
    const [token] = parseQuery('projeto = "Portal E-com');

    expect(token).toMatchObject({ kind: "invalid" });
    expect((token as { reason: string }).reason).toContain("aspas");
  });

  it("operador inválido para o tipo do campo", () => {
    const [contem] = parseQuery("severidade ~ HIGH");
    expect(contem).toMatchObject({ kind: "invalid" });
    expect((contem as { reason: string }).reason).toContain("~");

    const [diferente] = parseQuery("titulo != injection");
    expect(diferente).toMatchObject({ kind: "invalid" });
  });

  it("um token inválido não impede os válidos de serem lidos", () => {
    const tokens = parseQuery("gravidade = HIGH status = OPEN");

    expect(tokens.some((t) => t.kind === "invalid")).toBe(true);
    expect(filtros(tokens).some((t) => t.kind === "filter" && t.field === "status")).toBe(true);
  });
});

describe("tokensToParams", () => {
  it("enum vira parâmetro separado por vírgula", () => {
    const params = tokensToParams(parseQuery("severidade = HIGH, CRITICAL"));

    expect(params.get("severity")).toBe("HIGH,CRITICAL");
  });

  it("campos diferentes viram parâmetros diferentes (AND no backend)", () => {
    const params = tokensToParams(parseQuery("severidade = HIGH status = OPEN owasp = A03"));

    expect(params.get("severity")).toBe("HIGH");
    expect(params.get("status")).toBe("OPEN");
    expect(params.get("owaspCategory")).toBe("A03");
  });

  it("!= vira o complemento do conjunto", () => {
    const params = tokensToParams(parseQuery("status != CLOSED"));

    // a API não tem operador de negação — a negação é resolvida aqui
    expect(params.get("status")!.split(",").sort()).toEqual(["FIXED", "IN_PROGRESS", "OPEN"]);
  });

  it("token inválido NÃO é enviado", () => {
    const params = tokensToParams(parseQuery("severidade = URGENTE status = OPEN"));

    expect(params.get("severity")).toBeNull();
    expect(params.get("status")).toBe("OPEN");
  });

  it("entidade só vai como id; nome digitado à mão é descartado", () => {
    const semId = tokensToParams(parseQuery("projeto = Portal"));
    expect(semId.get("projectId")).toBeNull();

    const comId = tokensToParams(parseQuery("projeto = cmsolfd7d0026px4gy5sx4ajm"));
    expect(comId.get("projectId")).toBe("cmsolfd7d0026px4gy5sx4ajm");
  });

  it("texto livre e titulo ~ alimentam o mesmo search", () => {
    expect(tokensToParams(parseQuery("sql injection")).get("search")).toBe("sql injection");
    expect(tokensToParams(parseQuery("titulo ~ xss")).get("search")).toBe("xss");
    expect(tokensToParams(parseQuery("titulo ~ xss refletido")).get("search")).toBe("xss refletido");
  });

  it("nenhum token produz nenhum parâmetro", () => {
    expect([...tokensToParams([]).keys()]).toEqual([]);
  });
});

describe("paramsToTokens", () => {
  it("reconstrói os filtros a partir da URL", () => {
    const params = new URLSearchParams("severity=HIGH,CRITICAL&status=OPEN&search=sql");

    const tokens = paramsToTokens(params);

    expect(tokens).toContainEqual(
      expect.objectContaining({ field: "severidade", operator: "=", values: ["HIGH", "CRITICAL"] }),
    );
    expect(tokens).toContainEqual(expect.objectContaining({ field: "status", values: ["OPEN"] }));
    expect(tokens).toContainEqual(expect.objectContaining({ kind: "text", value: "sql" }));
  });

  it("ignora parâmetros que não são do wizard", () => {
    const tokens = paramsToTokens(new URLSearchParams("page=3&sortBy=severity&severity=HIGH"));

    expect(filtros(tokens)).toHaveLength(1);
  });

  it("URL vazia não produz token", () => {
    expect(paramsToTokens(new URLSearchParams())).toEqual([]);
  });
});

describe("ida e volta", () => {
  const casos = [
    "severidade = HIGH",
    "severidade = HIGH, CRITICAL",
    "status != CLOSED",
    "titulo ~ injection",
    "severidade = HIGH, CRITICAL status != CLOSED",
    "severidade = HIGH owasp = A03 status = OPEN",
    'projeto = "Portal E-commerce"',
    "sql injection",
    "sql injection severidade = CRITICAL",
  ];

  it.each(casos)("tokensToString(parseQuery(x)) reparseia igual: %s", (entrada) => {
    const original = parseQuery(entrada);
    const reparseado = parseQuery(tokensToString(original));

    expect(reparseado).toEqual(original);
  });

  it.each(casos)("os parâmetros da API sobrevivem à ida e volta: %s", (entrada) => {
    const antes = tokensToParams(parseQuery(entrada));
    const depois = tokensToParams(parseQuery(tokensToString(parseQuery(entrada))));

    expect(depois.toString()).toBe(antes.toString());
  });

  it("params → tokens → params é estável", () => {
    const antes = new URLSearchParams("severity=HIGH,CRITICAL&status=OPEN&search=sql");

    const depois = tokensToParams(paramsToTokens(antes));

    expect(depois.get("severity")).toBe("HIGH,CRITICAL");
    expect(depois.get("status")).toBe("OPEN");
    expect(depois.get("search")).toBe("sql");
  });
});

describe("tokenLabel", () => {
  it("mostra o nome da entidade, não o id", () => {
    const [token] = parseQuery("projeto = cmsolfd7d0026px4gy5sx4ajm");

    const rotulo = tokenLabel(token!, () => "Portal E-commerce");

    expect(rotulo).toBe("projeto = Portal E-commerce");
  });

  it("cai no id quando não há nome resolvido", () => {
    const [token] = parseQuery("projeto = cmsolfd7d0026px4gy5sx4ajm");

    expect(tokenLabel(token!)).toContain("cmsolfd7d0026px4gy5sx4ajm");
  });

  it("token inválido mostra o texto cru", () => {
    const [token] = parseQuery("gravidade = HIGH");

    expect(tokenLabel(token!)).toBe("gravidade = HIGH");
  });
});

describe("analisarContexto — o que sugerir na posição do cursor", () => {
  it("barra vazia pede um campo", () => {
    expect(analisarContexto("")).toEqual({ tipo: "campo", prefixo: "", inicio: 0 });
  });

  it("palavra sendo digitada é um campo em construção", () => {
    expect(analisarContexto("sev")).toEqual({ tipo: "campo", prefixo: "sev", inicio: 0 });
  });

  it("depois do operador, pede o VALOR daquele campo", () => {
    expect(analisarContexto("severidade = ")).toMatchObject({ tipo: "valor", field: "severidade", prefixo: "" });
    expect(analisarContexto("severidade =")).toMatchObject({ tipo: "valor", field: "severidade" });
  });

  it("valor sendo digitado traz o prefixo, para filtrar a lista", () => {
    const ctx = analisarContexto("severidade = HI");

    expect(ctx).toMatchObject({ tipo: "valor", field: "severidade", prefixo: "HI" });
    expect("severidade = HI".slice(ctx.inicio)).toBe("HI");
  });

  it("depois da vírgula, pede outro valor do MESMO campo", () => {
    expect(analisarContexto("severidade = HIGH, ")).toMatchObject({ tipo: "valor", field: "severidade", prefixo: "" });
    expect(analisarContexto("severidade = HIGH, CRI")).toMatchObject({ tipo: "valor", field: "severidade", prefixo: "CRI" });
  });

  it("valor terminado com espaço começa uma expressão nova", () => {
    // sem isto, "severidade = HIGH " continuaria oferecendo severidades, e a
    // pessoa nunca descobriria que dá para somar outro campo
    expect(analisarContexto("severidade = HIGH ")).toMatchObject({ tipo: "campo", prefixo: "" });
  });

  it("a segunda expressão é analisada sozinha", () => {
    expect(analisarContexto("severidade = HIGH sta")).toMatchObject({ tipo: "campo", prefixo: "sta" });
    expect(analisarContexto("severidade = HIGH status = OP")).toMatchObject({
      tipo: "valor",
      field: "status",
      prefixo: "OP",
    });
  });

  it("campo desconhecido antes do operador não finge saber o valor", () => {
    expect(analisarContexto("gravidade = ")).toMatchObject({ tipo: "campo" });
  });

  it("respeita o cursor no meio do texto", () => {
    const texto = "severidade = HIGH status = OPEN";
    // cursor logo depois de "severidade = HI"
    expect(analisarContexto(texto, 15)).toMatchObject({ tipo: "valor", field: "severidade", prefixo: "HI" });
  });
});

describe("aplicarSugestao", () => {
  it("escolher um campo já emenda o operador", () => {
    const ctx = analisarContexto("sev");

    expect(aplicarSugestao("sev", ctx, "severidade")).toEqual({ texto: "severidade = ", cursor: 13 });
  });

  it("escolher um valor emenda um espaço e fecha a expressão", () => {
    const entrada = "severidade = HI";
    const ctx = analisarContexto(entrada);

    const { texto } = aplicarSugestao(entrada, ctx, "HIGH");

    expect(texto).toBe("severidade = HIGH ");
    expect(parseQuery(texto)[0]).toMatchObject({ field: "severidade", values: ["HIGH"] });
  });

  it("valor com espaço sai entre aspas, para o parser não quebrá-lo", () => {
    const entrada = "projeto = ";
    const ctx = analisarContexto(entrada);

    const { texto } = aplicarSugestao(entrada, ctx, "Portal E-commerce");

    expect(texto).toBe('projeto = "Portal E-commerce" ');
    expect(parseQuery(texto)[0]).toMatchObject({ field: "projeto", values: ["Portal E-commerce"] });
  });

  it("preserva o que vem depois do cursor", () => {
    const entrada = "sev status = OPEN";
    const ctx = analisarContexto(entrada, 3);

    expect(aplicarSugestao(entrada, ctx, "severidade").texto).toBe("severidade =  status = OPEN");
  });

  it("o resultado de aplicar uma sugestão é sempre parseável", () => {
    let texto = "";
    for (const escolha of ["severidade", "HIGH", "status", "OPEN"]) {
      const ctx = analisarContexto(texto);
      texto = aplicarSugestao(texto, ctx, escolha).texto;
      expect(() => parseQuery(texto)).not.toThrow();
    }
    expect(filtros(parseQuery(texto))).toHaveLength(2);
  });
});

describe("camposUsados", () => {
  it("lista os campos já presentes", () => {
    expect(camposUsados("severidade = HIGH status = OPEN").sort()).toEqual(["severidade", "status"]);
  });

  it("ignora token inválido e texto livre", () => {
    expect(camposUsados("gravidade = HIGH sql injection")).toEqual([]);
  });
});

describe("🎯 nunca lança", () => {
  const entradasHostis = [
    "",
    "   ",
    "=",
    "==",
    "!=",
    "~",
    ",",
    ",,,",
    "severidade",
    "severidade =",
    "severidade = ,",
    "severidade == HIGH",
    "= HIGH",
    '"',
    "''",
    '"aberta',
    "severidade = 'HIGH",
    "a = b = c",
    "projeto = = =",
    "!@#$%^&*()",
    "\\",
    "\n\t",
    "🙂",
    "severidade = HIGH ".repeat(200),
    "x".repeat(5000),
    "titulo ~ %_%",
  ];

  it.each(entradasHostis)("parseQuery não lança: %j", (entrada) => {
    expect(() => parseQuery(entrada)).not.toThrow();
  });

  it.each(entradasHostis)("o pipeline inteiro não lança: %j", (entrada) => {
    expect(() => {
      const tokens = parseQuery(entrada);
      tokensToParams(tokens);
      tokensToString(tokens);
      tokens.forEach((t) => tokenLabel(t));
      const ctx = analisarContexto(entrada);
      aplicarSugestao(entrada, ctx, "HIGH");
      camposUsados(entrada);
    }).not.toThrow();
  });

  it("digitar caractere a caractere nunca lança (é o caso real da barra)", () => {
    const frase = 'severidade = HIGH, CRITICAL status != CLOSED projeto = "Portal E-commerce"';

    for (let i = 0; i <= frase.length; i += 1) {
      const parcial = frase.slice(0, i);
      expect(() => tokensToParams(parseQuery(parcial))).not.toThrow();
    }
  });
});
