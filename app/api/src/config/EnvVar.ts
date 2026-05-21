import 'dotenv/config';
import { EnvKey } from './enum/EnvKeys'

export class EnvVar {
    private constructor() { }

    public static getString(chave:EnvKey):string {
        const valor = process.env[chave];

        if (valor === undefined) {
            throw new Error(`Variavel ${chave} não definida no .env`);
        }
        return valor;
    }

    public static getNumber(chave:EnvKey):number {
        const valor = this.getString(chave);
        const valorConvertido = Number(valor);

        if (Number.isNaN(valorConvertido)) {
            throw new TypeError(`Variavel ${chave} deve ser um numero`);
        }
        return valorConvertido;
    }

    public static getBoolean(chave:EnvKey):boolean {
        const valor = this.getString(chave).toLowerCase();

        return ['true', '1', 'yes', 'on'].includes(valor);
    }

    public static get SERVER_PORT():number {
        return this.getNumber(EnvKey.SERVER_PORT);
    }
    public static get DATABASE_URL():string {
        return this.getString(EnvKey.DATABASE_URL);
    }
}