/**
 * use-api-error.ts
 *
 * Versão enxuta do hook do web (app/web/src/hooks/use-api-error.ts) — só os
 * códigos que o mobile realmente pode encontrar (login + leitura). Sem
 * criação/edição no mobile, os códigos de validação (INVALID_*, MISSING_*
 * de escrita) nunca aparecem aqui.
 */

import { useCallback } from "react";
import axios from "axios";

const MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "Você precisa estar logado para continuar.",
  INVALID_TOKEN: "Sua sessão expirou. Faça login novamente.",
  INVALID_CREDENTIALS: "E-mail ou senha incorretos.",
  FORBIDDEN: "Você não tem permissão para acessar isso.",
  PROJECT_NOT_FOUND: "Projeto não encontrado.",
  VULNERABILITY_NOT_FOUND: "Finding não encontrado.",
  USER_NOT_FOUND: "Usuário não encontrado.",
};

function messageForCode(code: string): string {
  if (MESSAGES[code]) return MESSAGES[code];
  if (code.endsWith("_NOT_FOUND")) return "Não encontrado.";
  return "Não foi possível concluir a ação. Tente novamente.";
}

function getApiErrorCode(error: unknown): string | undefined {
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
      return "Não foi possível conectar ao servidor. Confira o endereço da API nas Configurações do app e sua conexão.";
    }
    return "Não foi possível concluir a ação. Tente novamente.";
  }, []);
}
