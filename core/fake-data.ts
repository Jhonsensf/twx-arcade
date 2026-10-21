// Datos 100 % inventados. Ningún parecido con clientes reales.

export const fakeData = {
  empresas: [
    { id: "E1", nombre: "Conservas Cabo Sur", sector: "Alimentación", empleadosEnPrograma: 42, idiomas: ["inglés", "francés"] },
    { id: "E2", nombre: "Logística Andarax", sector: "Transporte", empleadosEnPrograma: 18, idiomas: ["inglés"] },
    { id: "E3", nombre: "Hoteles Mar de Alborán", sector: "Turismo", empleadosEnPrograma: 65, idiomas: ["inglés", "alemán", "italiano"] },
    { id: "E4", nombre: "Tecnologías Tabernas", sector: "Software", empleadosEnPrograma: 9, idiomas: ["inglés"] },
  ],
  alumnos: [
    { id: "A01", nombre: "Lucía Marín", empresa: "E1", idioma: "inglés", nivel: "B1", horasContratadas: 40, horasConsumidas: 31, ultimaClase: "2026-10-14", rachaSemanas: 6 },
    { id: "A02", nombre: "Raúl Céspedes", empresa: "E1", idioma: "francés", nivel: "A2", horasContratadas: 30, horasConsumidas: 4, ultimaClase: "2026-08-29", rachaSemanas: 0 },
    { id: "A03", nombre: "Marta Robles", empresa: "E2", idioma: "inglés", nivel: "B2", horasContratadas: 40, horasConsumidas: 38, ultimaClase: "2026-10-15", rachaSemanas: 11 },
    { id: "A04", nombre: "Iván Toledo", empresa: "E2", idioma: "inglés", nivel: "A1", horasContratadas: 20, horasConsumidas: 12, ultimaClase: "2026-10-09", rachaSemanas: 2 },
    { id: "A05", nombre: "Sofía Lanz", empresa: "E3", idioma: "alemán", nivel: "A2", horasContratadas: 50, horasConsumidas: 22, ultimaClase: "2026-10-13", rachaSemanas: 4 },
    { id: "A06", nombre: "Diego Ferrer", empresa: "E3", idioma: "inglés", nivel: "C1", horasContratadas: 30, horasConsumidas: 30, ultimaClase: "2026-10-01", rachaSemanas: 0 },
    { id: "A07", nombre: "Nerea Quintana", empresa: "E3", idioma: "italiano", nivel: "B1", horasContratadas: 40, horasConsumidas: 9, ultimaClase: "2026-09-20", rachaSemanas: 0 },
    { id: "A08", nombre: "Pablo Ureña", empresa: "E3", idioma: "inglés", nivel: "B2", horasContratadas: 40, horasConsumidas: 27, ultimaClase: "2026-10-15", rachaSemanas: 8 },
    { id: "A09", nombre: "Carmen Vidal", empresa: "E4", idioma: "inglés", nivel: "B2", horasContratadas: 25, horasConsumidas: 25, ultimaClase: "2026-10-10", rachaSemanas: 5 },
    { id: "A10", nombre: "Hugo Salinas", empresa: "E4", idioma: "inglés", nivel: "A2", horasContratadas: 25, horasConsumidas: 0, ultimaClase: null, rachaSemanas: 0 },
    { id: "A11", nombre: "Elena Prados", empresa: "E1", idioma: "inglés", nivel: "C1", horasContratadas: 40, horasConsumidas: 19, ultimaClase: "2026-10-12", rachaSemanas: 3 },
    { id: "A12", nombre: "Tomás Almagro", empresa: "E2", idioma: "inglés", nivel: "B1", horasContratadas: 30, horasConsumidas: 15, ultimaClase: "2026-10-02", rachaSemanas: 1 },
  ],
};

export type FakeData = typeof fakeData;
