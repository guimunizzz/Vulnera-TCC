export class Plan {
  private readonly _id?: string;
  private _name: string = "";
  private _maxApplications: number = 0;
  private _price: number = 0;
  private readonly _createAt?: Date;

  constructor(
    name: string,
    maxApplications: number = 0,
    price: number = 0,
    createAt?: Date,
    id?: string,
  ) {
    this._id = id;
    this.Name = name;
    this.MaxApplications = maxApplications;
    this.Price = price;
    this._createAt = createAt;
  }

  get Id(): string | undefined {
    return this._id;
  }

  public get Name(): string {
    return this._name;
  }

  public get MaxApplications(): number {
    return this._maxApplications;
  }

  public get Price(): number {
    return this._price;
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

  public set Price(value: number) {
    this._validarPrice(value);
    this._price = value;
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

  private _validarPrice(value: number): void {
    if (typeof value !== "number" || value < 0) {
      throw new TypeError("O preço do plano deve ser um número não negativo");
    }
  }
}
