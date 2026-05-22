import express from "express";
import { EnvVar } from "./config/EnvVar";
import path from 'node:path';
import router from "./routes/route";

const app = express();

app.use(express.json());
app.use('/', router)

app.use('/produtos', express.static(path.resolve('uploads/Images')));

app.listen(EnvVar.SERVER_PORT, ()=> {
    console.log(`Servidor rodando em http://localhost:${EnvVar.SERVER_PORT}`)
})