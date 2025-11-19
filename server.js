import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
app.use(cors());
app.use(express.json());

// 🚀 Servidor HTTP + Socket.IO
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

// 🚀 Conexión MySQL en Railway (Variables de entorno)
const db = await mysql.createPool({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  port: process.env.MYSQLPORT,
  database: process.env.MYSQLDATABASE,
});

// 👉 Crear invitación
app.post("/api/invitaciones", async (req, res) => {
  try {
    const { abrev, nombre, pases } = req.body;

    const [result] = await db.execute(
      "INSERT INTO invitacion (abrev, nombre, pases, qrs, confirmacion, link) VALUES (?, ?, ?, ?, ?, ?)",
      [abrev, nombre, pases, "-", "pendiente", "-"]
    );

    const id = result.insertId;
    const link = `https://maricelayhugo2025.com/invitacion/${id}`;

    await db.execute("UPDATE invitacion SET link=? WHERE id=?", [link, id]);

    const nuevo = {
      id,
      abrev,
      nombre,
      pases,
      qrs: "-",
      confirmacion: "pendiente",
      link,
    };

    io.emit("invitacion-nueva", nuevo);
    res.json(nuevo);

  } catch (err) {
    res.status(500).json({ error: "Error creando invitación" });
  }
});

// 👉 Obtener invitación
app.get("/api/invitaciones/:id", async (req, res) => {
  const [rows] = await db.execute("SELECT * FROM invitacion WHERE id=?", [
    req.params.id,
  ]);

  if (rows.length === 0) return res.status(404).json({ error: "No existe" });
  res.json(rows[0]);
});

// 👉 Confirmar invitación
app.put("/api/invitaciones/:id/confirmar", async (req, res) => {
  try {
    const { id } = req.params;
    const { confirmacion, pases } = req.body;

    const pasesFinal = confirmacion === "no_asistira" ? 0 : pases;

    await db.execute(
      "UPDATE invitacion SET confirmacion=?, pases=? WHERE id=?",
      [confirmacion, pasesFinal, id]
    );

    const [rows] = await db.execute("SELECT * FROM invitacion WHERE id=?", [id]);

    io.emit("invitacion-actualizada", rows[0]);
    res.json(rows[0]);

  } catch (err) {
    res.status(500).json({ error: "Error confirmando asistencia" });
  }
});

// 🚀 Socket
io.on("connection", socket => {
  console.log("🟢 Cliente conectado:", socket.id);
});

// 🚀 Puerto para producción
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () =>
  console.log(`Backend corriendo en puerto: ${PORT}`)
);
