export class Company {
  private readonly _id: string;
  private _name: string = "";
  private _planId: number = 0;
  private readonly _createdAt?: Date;
  private readonly _updatedAt?: Date;


constructor(    id: string,
    name: string,
    planId: number,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    this._id = id;
    this._name = name;
    this._planId = planId;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }

  public get Id(): string {
    return this._id;
  }

  public get Name(): string {
    return this._name;
  }

  public get PlanId(): number {
    return this._planId;
  }

  public get CreatedAt(): Date | undefined {
    return this._createdAt;
  }

  public get UpdatedAt(): Date | undefined {
    return this._updatedAt;
  }

  public set Name(value: string) {
    this._validarName(value);
    this._name = value;
  }

  public set PlanId(value: number) {
    this._validarPlanId(value);
    this._planId = value;
  }

  // Validações
  private _validarName(value: string): void {
    if (typeof value !== "string") {
      throw new TypeError("O nome da empresa deve ser um texto(string)");
    }

    if (value.trim() === "") {
      throw new Error("O nome da empresa não pode ser vazio");
    }
  }

  private _validarPlanId(value: number): void {
    if (typeof value !== "number") {
      throw new TypeError("O ID do plano deve ser um número(integer)");
    }

    if (value.toString().trim() === "") {
      throw new Error("O ID do plano não pode ser vazio");
    }
  }
}
