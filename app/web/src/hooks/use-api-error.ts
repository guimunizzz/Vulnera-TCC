/**
 * use-api-error.ts
 *
 * Traduz erros da Vulnera API (código SCREAMING_SNAKE) pra mensagem PT-BR.
 *
 * O backend não é 100% consistente na chave do corpo do erro: alguns
 * controllers (auth, user) devolvem { code }, outros (plan, company,
 * subscription, application, project) devolvem { error } — ver CLAUDE.md,
 * ambos os formatos carregam o código em SCREAMING_SNAKE. Este hook lê os dois.
 */

import { useCallback } from "react";
import axios from "axios";

const MESSAGES: Record<string, string> = {
  // auth
  UNAUTHORIZED: "Você precisa estar logado para continuar.",
  INVALID_TOKEN: "Sua sessão expirou. Faça login novamente.",
  INVALID_CREDENTIALS: "E-mail ou senha incorretos.",
  EMAIL_ALREADY_EXISTS: "Este e-mail já está cadastrado.",
  INVALID_EMAIL: "E-mail inválido.",
  WEAK_PASSWORD: "A senha precisa ter pelo menos 8 caracteres.",

  // user
  USER_NOT_FOUND: "Usuário não encontrado.",
  FORBIDDEN: "Você não tem permissão para fazer isso.",
  SELF_DELETE_FORBIDDEN: "Você não pode remover a própria conta.",

  // plan
  PLAN_NOT_FOUND: "Plano não encontrado.",
  PLAN_ALREADY_EXISTS: "Já existe um plano com esse nome.",
  INVALID_MAX_APPLICATIONS: "Quantidade de aplicações inválida.",
  INVALID_MAX_PROJECTS: "Quantidade de projetos inválida.",
  INVALID_PRICE: "Preço inválido.",
  INVALID_INCLUDES_REMEDIATION: "Valor inválido para remediação incluída.",

  // company
  COMPANY_NOT_FOUND: "Empresa não encontrada.",
  COMPANY_ALREADY_EXISTS: "Já existe uma empresa com esse CNPJ.",
  INVALID_CNPJ: "CNPJ inválido. Use 14 dígitos ou o formato 00.000.000/0000-00.",
  INVALID_PLAN_ID: "Selecione um plano válido.",
  USER_ALREADY_HAS_COMPANY: "Você já está vinculado a uma empresa.",
  USER_HAS_NO_COMPANY: "Você ainda não tem uma empresa cadastrada.",

  // subscription
  SUBSCRIPTION_NOT_FOUND: "Assinatura não encontrada.",
  ALREADY_HAS_ACTIVE_SUBSCRIPTION: "Esta empresa já tem uma assinatura ativa.",

  // application
  APPLICATION_NOT_FOUND: "Aplicação não encontrada.",
  INVALID_URL: "URL inválida. Use o formato https://exemplo.com.",
  INVALID_ENVIRONMENT: "Ambiente inválido.",
  NO_ACTIVE_SUBSCRIPTION: "Sua empresa ainda não tem uma assinatura ativa. Aguarde a aprovação do admin.",
  PLAN_LIMIT_REACHED: "Limite de aplicações do plano atual atingido.",

  // project
  PROJECT_NOT_FOUND: "Projeto não encontrado.",
  INVALID_APPLICATION_ID: "Selecione uma aplicação válida.",
  INVALID_ANALYSIS_TYPE: "Tipo de análise inválido.",
  INVALID_ANALYSIS_LEVEL: "Nível de análise inválido.",
  INVALID_HAS_REMEDIATION: "Valor inválido para remediação.",
  APPLICATION_ALREADY_HAS_PROJECT: "Esta aplicação já tem um projeto de análise.",
  INVALID_STATUS_TRANSITION: "Essa transição de status não é permitida.",

  // project member
  INVALID_USER_ID: "Selecione um usuário válido.",
  USER_NOT_PENTESTER: "Só é possível atribuir usuários com perfil Pentester.",
  MEMBER_ALREADY_EXISTS: "Este pentester já está atribuído ao projeto.",
  MEMBER_NOT_FOUND: "Este usuário não está atribuído ao projeto.",

  // genérico
  INTERNAL_ERROR: "Algo deu errado no servidor. Tente novamente.",
};

function messageForCode(code: string): string {
  if (MESSAGES[code]) return MESSAGES[code];
  if (code.startsWith("MISSING_") || code.startsWith("INVALID_")) return "Verifique os dados informados.";
  if (code.endsWith("_NOT_FOUND")) return "Não encontrado.";
  if (code.endsWith("_ALREADY_EXISTS")) return "Este registro já existe.";
  return "Não foi possível concluir a ação. Tente novamente.";
}

/** Extrai o código bruto do erro — útil quando a tela precisa de lógica extra
 * além da mensagem genérica (ex: PLAN_LIMIT_REACHED mostrando o número do limite). */
export function getApiErrorCode(error: unknown): string | undefined {
  if (axios.isAxiosError(error)) {
    return (error.response?.data?.code ?? error.response?.data?.error) as string | undefined;
  }
  return undefined;
}

export function useApiError(): (error: unknown) => string {
  return useCallback((error: unknown): string => {
    const code = getApiErrorCode(error);
    if (code) return messageForCode(code);
    if (axios.isAxiosError(error) && error.code === "ERR_NETWORK") {
      return "Não foi possível conectar ao servidor.";
    }
    return "Não foi possível concluir a ação. Tente novamente.";
  }, []);
}
