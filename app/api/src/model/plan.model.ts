export class Plan {
  private readonly _id: string;
  private _name: string = "";
  private _maxApplications: number = 0;
  private readonly _createAt?: Date;

  constructor(
    id: string,
    name: string,
    maxApplications: number = 0,
    createAt?: Date,
  ) {
    this._id = id;
    this.Name = name;
    this.MaxApplications = maxApplications;
    this._createAt = createAt;
  }

  public get Id(): string {
    return this._id;
  }

  public get Name(): string {
    return this._name;
  }

  public get MaxApplications(): number {
    return this._maxApplications;
  }

  public get CreateAt(): Date | undefined {
    return this._createAt;
  }

  public set Name(value: string) {
    this._validarName(value);
    this._name = value;
  }

  public set MaxApplications(value: number) {
    this._validarMaxApplications(value);
    this._maxApplications = value;
  }

  private _validarName(value: string): void {
    if (typeof value !== "string") {
      throw new TypeError("O nome do plano deve ser um texto(string)");
    }
  }

  private _validarMaxApplications(value: number): void {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      throw new TypeError(
        "O número máximo de aplicações deve ser um inteiro não negativo",
      );
    }
  }

}
