-- =====================================================================
-- Importa el plan de cuentas real del usuario (231 cuentas originales,
-- 224 en la versión final que compartió tras sacar cajas que no
-- correspondían) y ajusta cajas/cuentas_contables para que puedan
-- representarlo. Aditivo: nada de lo que ya carga un movimiento de caso
-- deja de funcionar.
-- =====================================================================

-- =====================================================================
-- 1. cuentas_contables: el esquema de 0041 solo soportaba tipo
-- ingreso/egreso y no tenía jerarquía. El plan de cuentas real tiene
-- Activo/Pasivo/Patrimonio Neto además de Resultados (que sí se separa
-- en ingreso/egreso). Se guarda igual el código padre para preservar la
-- jerarquía tal cual viene del plan de cuentas — sin FK contra el propio
-- código porque el archivo del usuario tiene códigos padre que no
-- aparecen como fila propia (huecos del export original, no un error
-- nuestro), y una FK estricta haría fallar la carga.
-- =====================================================================

alter table cuentas_contables drop constraint if exists cuentas_contables_tipo_check;
alter table cuentas_contables add constraint cuentas_contables_tipo_check
  check (tipo in ('activo', 'pasivo', 'pn', 'resultado', 'ingreso', 'egreso'));

alter table cuentas_contables add column if not exists codigo_padre text;

insert into cuentas_contables (codigo, nombre, tipo, imputable, codigo_padre) values
  ('1', 'Activo', 'activo', false, null),
  ('1.1', 'Activo corriente', 'activo', false, '1'),
  ('1.1.1', 'Caja y Bancos', 'activo', false, '1.1'),
  ('1.1.1.1', 'Caja pesos', 'activo', true, '1.1.1'),
  ('1.1.1.11', 'Caja en Financiera', 'activo', true, '1.1.1'),
  ('1.1.1.12', 'Caja en USD', 'activo', true, '1.1.1'),
  ('1.1.1.13', 'Caja de Seguridad en USD', 'activo', true, '1.1.1'),
  ('1.1.1.14', 'Caja de Seguridad en $', 'activo', true, '1.1.1'),
  ('1.1.1.2', 'Fondo Fijos en pesos', 'activo', true, '1.1.1'),
  ('1.1.1.6', 'Banco Galicia CTa Cte', 'activo', true, '1.1.1'),
  ('1.1.1.7', 'Caja Chica', 'activo', true, '1.1.1'),
  ('1.1.2', 'Creditos por ventas', 'activo', false, '1.1'),
  ('1.1.2.1', 'Deudores por ventas', 'activo', true, '1.1.2'),
  ('1.1.2.2', 'Valores a Depositar', 'activo', true, '1.1.2'),
  ('1.1.2.3', 'Cheques diferidos a cobrar', 'activo', true, '1.1.2'),
  ('1.1.2.4', 'Deudores Morosos en Gestión JUdicial', 'activo', true, '1.1.2'),
  ('1.1.2.5', 'Cheques rechazados de terceros', 'activo', true, '1.1.2'),
  ('1.1.2.6', 'Deudores Morosos', 'activo', true, '1.1.2'),
  ('1.1.3', 'Créditos Fiscales', 'activo', false, '1.1'),
  ('1.1.3.1', 'IVA Crédito Fiscal', 'activo', true, '1.1.3'),
  ('1.1.3.10', 'Percepciones Imp Ganancias Sufridas', 'activo', true, '1.1.3'),
  ('1.1.3.11', 'Regimen recaudacion SIRCREB', 'activo', true, '1.1.3'),
  ('1.1.3.12', 'AFIP', 'activo', true, '1.1.3'),
  ('1.1.3.13', 'Crédito Imp. Deb/Cred', 'activo', true, '1.1.3'),
  ('1.1.3.14', 'Anticipo de Ganancias', 'activo', true, '1.1.3'),
  ('1.1.3.15', 'Saldo a favor Ganancias', 'activo', true, '1.1.3'),
  ('1.1.3.16', 'Saldo a Favor IIBB', 'activo', true, '1.1.3'),
  ('1.1.3.2', 'IVA Saldo Tecnico a Favor', 'activo', true, '1.1.3'),
  ('1.1.3.3', 'IVA Saldo a favor Libre Disp.', 'activo', true, '1.1.3'),
  ('1.1.3.4', 'Retenciones IVA sufridas', 'activo', true, '1.1.3'),
  ('1.1.3.5', 'Percepciones IVA sufridas', 'activo', true, '1.1.3'),
  ('1.1.3.6', 'Retenciones Imp IIBB Sufridas', 'activo', true, '1.1.3'),
  ('1.1.3.7', 'Percepciones Imp IIBB Sufridas', 'activo', true, '1.1.3'),
  ('1.1.3.8', 'Retenciones SUSS sufridas', 'activo', true, '1.1.3'),
  ('1.1.3.9', 'Retenciones Imp Ganancias sufridas', 'activo', true, '1.1.3'),
  ('1.1.4', 'Bienes de Cambio', 'activo', false, '1.1'),
  ('1.1.4.1', 'Mercaderia', 'activo', true, '1.1.4'),
  ('1.1.4.2', 'Anticipos a Proveedores', 'activo', true, '1.1.4'),
  ('1.1.4.3', 'Productos en proceso', 'activo', true, '1.1.4'),
  ('1.1.4.4', 'Vehiculos para la venta', 'activo', false, '1.1.4'),
  ('1.1.5', 'Cuentas Particulares', 'activo', false, '1.1'),
  ('1.1.5.1', 'Socio 1 Cta Particular', 'activo', true, '1.1.5'),
  ('1.1.5.2', 'Socio 2 Cta Particular', 'activo', true, '1.1.5'),
  ('1.1.6', 'Otros Creditos', 'activo', false, '1.1'),
  ('1.1.6.1', 'Alquileres pagados por adelantado', 'activo', true, '1.1.6'),
  ('1.1.6.2', 'Seguros pagados por adelantado', 'activo', true, '1.1.6'),
  ('1.1.6.3', 'Adelantos al Personal', 'activo', true, '1.1.6'),
  ('1.1.8', 'Inversión Temporaria', 'activo', false, '1.1'),
  ('1.1.8.1', 'Inversión en Cuenta  Banco Galicia', 'activo', true, '1.1.8'),
  ('1.2', 'Activo no corriente', 'activo', false, '1'),
  ('1.2.1', 'Bienes de Uso', 'activo', false, '1.2'),
  ('1.2.4.1', 'Rodados', 'activo', false, '1.2.4'),
  ('1.2.4.1.1', 'Valor origen rodados', 'activo', true, '1.2.4.1'),
  ('1.2.4.1.2', 'Valor Actualización Rodados', 'activo', true, '1.2.4.1'),
  ('1.2.4.1.3', 'Depreciación Acumulada Rodados', 'activo', true, '1.2.4.1'),
  ('1.2.4.2', 'Muebles y Utiles', 'activo', false, '1.2.4'),
  ('1.2.4.2.1', 'Valor Origen Muebles y Útiles', 'activo', true, '1.2.4.2'),
  ('1.2.4.2.2', 'Valor Actualizado Muebles y Útiles', 'activo', true, '1.2.4.2'),
  ('1.2.4.2.3', 'Depreciación Acumulada Muebles y Útiles', 'activo', true, '1.2.4.2'),
  ('1.2.4.3', 'Instalaciones', 'activo', false, '1.2.4'),
  ('1.2.4.3.1', 'Valor Origen Instalaciones', 'activo', true, '1.2.4.3'),
  ('1.2.4.3.2', 'Valor Actualizado Instalaciones', 'activo', true, '1.2.4.3'),
  ('1.2.4.3.3', 'Depreciación Acumulada de Instalaciones', 'activo', true, '1.2.4.3'),
  ('1.2.4.4', 'Inmuebles', 'activo', false, '1.2.4'),
  ('1.2.4.4.1', 'Valor Origen Terreno', 'activo', true, '1.2.4.4'),
  ('1.2.4.4.2', 'Valor Actualizado Inmueble Terreno', 'activo', true, '1.2.4.4'),
  ('1.2.4.4.3', 'Valor Origen Inmueble Edificio', 'activo', true, '1.2.4.4'),
  ('1.2.4.4.4', 'Valor Actualizado Inmueble Edificio', 'activo', true, '1.2.4.4'),
  ('1.2.4.4.5', 'Depreciacion Acumulada Inmueble', 'activo', true, '1.2.4.4'),
  ('1.2.4.5', 'Herramientas', 'activo', false, '1.2.4'),
  ('1.2.4.5.1', 'Valor de Origen Equipo Computación', 'activo', true, '1.2.4.5'),
  ('1.2.4.5.2', 'Valor Actualización Equipo de Computación', 'activo', true, '1.2.4.5'),
  ('1.2.4.5.3', 'Depreciación Acumulada Equipo Computación', 'activo', false, '1.2.4.5'),
  ('1.2.4.6', 'Mejora Inmuebles', 'activo', false, '1.2.4'),
  ('1.2.4.6.1', 'Valor de Origen Mejora Inmuebles', 'activo', true, '1.2.4.6'),
  ('1.2.4.6.2', 'Valor Actualizado Mejora Inmueble', 'activo', true, '1.2.4.6'),
  ('1.2.4.6.3', 'Depreciación Mejora Inmueble', 'activo', true, '1.2.4.6'),
  ('1.2.4.7', 'Equipos de Computación', 'activo', false, '1.2.4'),
  ('1.2.4.7.1', 'Valor de Origen Equipos de Computación', 'activo', true, '1.2.4.7'),
  ('1.2.4.7.2', 'Valor Actualización Equipos de Computación', 'activo', true, '1.2.4.7'),
  ('1.2.4.7.3', 'Depreciación Acumulada Equipos de Computación', 'activo', true, '1.2.4.7'),
  ('1.2.5', 'Activos Intangibles', 'activo', false, '1.2'),
  ('1.2.5.1', 'Gastos de Organización', 'activo', true, '1.2.5'),
  ('1.2.5.2', 'Amortización Acum. Gastos de Organización', 'activo', true, '1.2.5'),
  ('2', 'Pasivo', 'pasivo', false, null),
  ('2.1', 'Pasivo corriente', 'pasivo', false, '2'),
  ('2.1.1', 'Deudas Comerciales', 'pasivo', false, '2.1'),
  ('2.1.1.1', 'Proveedores en Cta Cte', 'pasivo', true, '2.1.1'),
  ('2.1.1.2', 'Provisiones de Ds Comerciales', 'pasivo', true, '2.1.1'),
  ('2.1.1.3', 'Anticipo de Clientes', 'pasivo', true, '2.1.1'),
  ('2.1.1.4', 'Cheques diferidos a pagar', 'pasivo', true, '2.1.1'),
  ('2.1.1.5', 'Anticipo Licitaciones', 'pasivo', true, '2.1.1'),
  ('2.1.1.6', 'Anticipo de Garantias', 'pasivo', true, '2.1.1'),
  ('2.1.2', 'Deudas Financieras', 'pasivo', false, '2.1'),
  ('2.1.2.1', 'Prestamos Bancarios  a pagar', 'pasivo', true, '2.1.2'),
  ('2.1.3', 'Deudas Sociales', 'pasivo', false, '2.1'),
  ('2.1.3.1', 'Remuneraciones a Pagar', 'pasivo', true, '2.1.3'),
  ('2.1.3.2', 'Cargas Sociales (SUSS) a pagar', 'pasivo', true, '2.1.3'),
  ('2.1.3.3', 'Retenciones SUSS a pagar', 'pasivo', true, '2.1.3'),
  ('2.1.3.4', 'Sindicato a pagar', 'pasivo', true, '2.1.3'),
  ('2.1.3.5', 'Seguro de Vida', 'pasivo', true, '2.1.3'),
  ('2.1.3.6', 'Provisiones laborales', 'pasivo', true, '2.1.3'),
  ('2.1.4', 'Deudas Fiscales', 'pasivo', false, '2.1'),
  ('2.1.4.1', 'IVA Débito Fiscal', 'pasivo', true, '2.1.4'),
  ('2.1.4.10', 'Bienes Personales a Pagar', 'pasivo', true, '2.1.4'),
  ('2.1.4.2', 'IVA Saldo DDJJ a Pagar', 'pasivo', true, '2.1.4'),
  ('2.1.4.3', 'Impuesto a las Ganancias a pagar', 'pasivo', true, '2.1.4'),
  ('2.1.4.4', 'Impuesto a los IIBB a pagar', 'pasivo', true, '2.1.4'),
  ('2.1.4.5', 'Percepciones Ganancias a Depositar', 'pasivo', true, '2.1.4'),
  ('2.1.4.6', 'Retenciones IVA a Depositar', 'pasivo', true, '2.1.4'),
  ('2.1.4.7', 'Retenciones Ganancias a Depositar', 'pasivo', true, '2.1.4'),
  ('2.1.4.8', 'Impuesto Diferido', 'pasivo', true, '2.1.4'),
  ('2.1.4.9', 'Plan Facilidades AFIP', 'pasivo', true, '2.1.4'),
  ('2.1.5', 'DGR', 'pasivo', false, '2.1'),
  ('2.1.5.1', 'Impuesto Inmobiliario a pagar', 'pasivo', true, '2.1.5'),
  ('2.1.5.2', 'Plan de Pago Impuesto Inmibiliario', 'pasivo', true, '2.1.5'),
  ('2.1.6', 'Municipales', 'pasivo', false, '2.1'),
  ('2.1.6.1', 'ABL a Pagar', 'pasivo', true, '2.1.6'),
  ('2.1.6.2', 'Patentes a Pagar', 'pasivo', true, '2.1.6'),
  ('2.1.6.3', 'Plan de Pago Tasa Seguridad e Higiene', 'pasivo', true, '2.1.6'),
  ('2.1.6.4', 'Tasa Seguridad e Higiene a pagar', 'pasivo', true, '2.1.6'),
  ('2.1.6.5', 'Contribución Publicidad y Propaganda', 'pasivo', true, '2.1.6'),
  ('2.1.6.6', 'Plan de Pagos Contrib. Publicidad y Propaganda', 'pasivo', true, '2.1.6'),
  ('2.1.6.7', 'Plan de Pagos ABL Vicente López', 'pasivo', true, '2.1.6'),
  ('2.1.6.8', 'Plan Facilidades AGIP IIBB', 'pasivo', true, '2.1.6'),
  ('2.1.8', 'Otras Deudas', 'pasivo', false, '2.1'),
  ('2.1.8.1', 'Acreedores Varios', 'pasivo', true, '2.1.8'),
  ('2.1.8.2', 'Dividendos en efectivo a pagar', 'pasivo', true, '2.1.8'),
  ('2.1.8.3', 'Honorarios Directores a Pagar', 'pasivo', true, '2.1.8'),
  ('2.1.8.4', 'Honorarios Profesionales a pagar', 'pasivo', true, '2.1.8'),
  ('2.1.8.5', 'Seguros a Pagar', 'pasivo', true, '2.1.8'),
  ('2.1.8.6', 'Pagos por cuenta y orden de terceros', 'pasivo', true, '2.1.8'),
  ('2.1.8.7', 'Alquileres a Pagar', 'pasivo', true, '2.1.8'),
  ('2.1.8.8', 'Tarjeta VISA a pagar', 'pasivo', true, '2.1.8'),
  ('2.1.8.9', 'Tarjeta AMEX a pagar', 'pasivo', true, '2.1.8'),
  ('2.2', 'Pasivo NO Corriente', 'pasivo', false, '2'),
  ('2.2.1', 'Deudas Financieras no Ctes', 'pasivo', false, '2.2'),
  ('2.2.2', 'Cuentas a pagar', 'pasivo', true, '2.2'),
  ('3', 'Patrimonio Neto', 'pn', false, null),
  ('3.1', 'Capital Social', 'pn', true, '3'),
  ('3.2', 'Reserva Legal', 'pn', true, '3'),
  ('3.3', 'Resultados No Asignados', 'pn', true, '3'),
  ('3.4', 'Resultados del ejercicio', 'pn', true, '3'),
  ('3.5', 'Ajuste de capital', 'pn', true, '3'),
  ('3.6', 'Aportes Irrevocables', 'pn', true, '3'),
  ('3.7', 'Reserva Voluntaria', 'pn', true, '3'),
  ('3.9', 'Reserva Capital de Trabajo', 'pn', true, '3'),
  ('4', 'Resultados', 'resultado', false, null),
  ('4.1', 'Ingresos', 'ingreso', false, '4'),
  ('4.1.1', 'Ventas', 'ingreso', true, '4.1'),
  ('4.1.10', 'Venta Rodado', 'ingreso', true, '4.1'),
  ('4.1.11', 'Servicio de transporte automotor de cargas', 'ingreso', true, '4.1'),
  ('4.1.12', 'Servicio de asesoramiento, dirección y gestión empresarial', 'ingreso', true, '4.1'),
  ('4.1.2', 'Ingresos Por Servicios de Bajas 04D', 'ingreso', true, '4.1'),
  ('4.1.2.1', 'Serv de Gestorias', 'ingreso', true, '4.1'),
  ('4.1.2.2', 'Serv. De Gestion Integral', 'ingreso', true, '4.1'),
  ('4.1.2.3', 'Servicio de informe de ingeniero', 'ingreso', true, '4.1'),
  ('4.1.2.4', 'Ingresos Por Servicios de Bajas 04C', 'ingreso', true, '4.1'),
  ('4.1.3', 'Conceptos no gravados por ventas', 'ingreso', true, '4.1'),
  ('4.1.5', 'Ventas Exentas', 'ingreso', true, '4.1'),
  ('4.1.6', 'Intereses Comerciales Ganados', 'ingreso', true, '4.1'),
  ('4.1.7', 'Intereses Financieros Ganados', 'ingreso', true, '4.1'),
  ('4.1.8', 'Descuentos Obtenidos', 'ingreso', true, '4.1'),
  ('4.1.9', 'Diferencia de Cambio', 'ingreso', true, '4.1'),
  ('4.2', 'Egresos', 'egreso', false, '4'),
  ('4.2.1', 'Gastos Operativos', 'egreso', false, '4.2'),
  ('4.2.1.1', 'Conceptos no gravados por compras', 'egreso', true, '4.2.1'),
  ('4.2.10.1', 'Informes y Verificaciones de Prestaciones de Servicios', 'egreso', true, '4.2.10'),
  ('4.2.10.2', 'Honorarios de Prestaciones de Servicios', 'egreso', true, '4.2.10'),
  ('4.2.2', 'Gastos de Compra y Ventas de Vehiculos', 'egreso', false, '4.2'),
  ('4.2.2.1', 'Gastos de Prestacion de Servicios', 'egreso', false, '4.2'),
  ('4.2.2.10', 'Gastos Reparaciones Cpra y Vta Vehiculos', 'egreso', true, '4.2.2'),
  ('4.2.2.11', 'Costo de vehiculos', 'egreso', true, '4.2.2'),
  ('4.2.2.12', 'Combustible de Compra y Vta de Vehiculos', 'egreso', true, '4.2.2'),
  ('4.2.2.13', 'Gastos de Rodado Cpra y Vta Vehiculos', 'egreso', true, '4.2.2'),
  ('4.2.2.14', 'Gastos de Patente por Compra y Vta de Vehiculos', 'egreso', true, '4.2.2'),
  ('4.2.2.15', 'Informes y Verificaciones de Compra y Venta de Autos', 'egreso', true, '4.2.2'),
  ('4.2.2.16', 'Correo y ecomiendas de Cpra y Vta de vehiculos', 'egreso', true, '4.2.2'),
  ('4.2.2.5', 'Gastos de Consumible Cpra y Vta Vehiculos', 'egreso', true, '4.2.2'),
  ('4.2.2.99', 'Depreciaciones Bienes de Uso', 'egreso', true, '4.2.2'),
  ('4.2.3.12', 'Gastos Consumible de Guarda', 'egreso', true, '4.2.3'),
  ('4.2.4', 'Gastos de Traslado', 'egreso', false, '4.2'),
  ('4.2.4.8', 'Traslados Externos', 'egreso', true, '4.2.4'),
  ('4.2.6', 'Gastos de 04', 'egreso', false, '4.2'),
  ('4.2.6.1', 'Sueldos', 'egreso', true, '4.2.6'),
  ('4.2.6.2', 'Honorarios Profesionales', 'egreso', true, '4.2.6'),
  ('4.2.6.3', 'Costo 04D de Bajas', 'egreso', true, '4.2.6'),
  ('4.2.6.4', 'Informes y Verificaciones', 'egreso', true, '4.2.6'),
  ('4.2.6.5', 'Correo, telegramas, envíos', 'egreso', true, '4.2.6'),
  ('4.2.6.7', 'Servicios Gestoría de 04', 'egreso', true, '4.2.6'),
  ('4.2.6.8', 'Sistema Informatico', 'egreso', true, '4.2.6'),
  ('4.2.6.9', 'Movilidad y Viaticos', 'egreso', true, '4.2.6'),
  ('4.3.4.6', 'Comisiones Financieras', 'egreso', true, '4.2.6'),
  ('4.2.8.7', 'Servicios  Gestoría de Subasta', 'egreso', true, '4.2.8'),
  ('4.3.1.11', 'Gastos de Limpieza', 'egreso', true, '4.3.1'),
  ('4.3.1.12', 'Gastos Consumible', 'egreso', true, '4.3.1'),
  ('4.3.1.13', 'Gastos de Mantenimiento', 'egreso', true, '4.3.1'),
  ('4.3.1.14', 'SAC y Vacaciones', 'egreso', true, '4.3.1'),
  ('4.3.1.15', 'Gastos del Personal', 'egreso', true, '4.3.1'),
  ('4.3.1.2', 'Cargas Sociales', 'egreso', true, '4.3.1'),
  ('4.3.1.3', 'Gastos Medicos', 'egreso', true, '4.3.1'),
  ('4.3.1.7', 'Gastos de Representación', 'egreso', true, '4.3.1'),
  ('4.3.1.9', 'Alquileres', 'egreso', true, '4.3.1'),
  ('4.3.2.12', 'Impuestos y Tasas', 'egreso', true, '4.3.2'),
  ('4.3.2.13', 'Impuestos y sellos', 'egreso', true, '4.3.2'),
  ('4.3.2.14', 'Tasa Insp. General de Justicia', 'egreso', true, '4.3.2'),
  ('4.3.2.15', 'Impuesto a las Ganancias', 'egreso', true, '4.3.2'),
  ('4.3.2.5', 'Papeleria y Utiles de Oficina', 'egreso', true, '4.3.2'),
  ('4.3.3', 'Gastos Comerciales', 'egreso', false, '4.3'),
  ('4.3.3.1', 'Sueldos Comercial', 'egreso', true, '4.3.3'),
  ('4.3.3.10', 'Gastos de Representación Comercial', 'egreso', true, '4.3.3'),
  ('4.3.3.99', 'Impuestos a los IIBB', 'egreso', true, '4.3.3'),
  ('4.3.4', 'Gastos Financieros', 'egreso', false, '4.3'),
  ('4.3.4.1', 'Gastos Bancarios', 'egreso', true, '4.3.4'),
  ('4.3.4.2', 'Impuestos Deb/Cred CtaCte (Ley25413)', 'egreso', true, '4.3.4'),
  ('4.3.4.3', 'Intereses Bancarios', 'egreso', true, '4.3.4'),
  ('4.3.4.4', 'Intereses Recargos y Multas', 'egreso', true, '4.3.4'),
  ('4.3.4.5', 'Diferencia por tipo de cambio', 'egreso', true, '4.3.4'),
  ('4.3.9', 'Otros Egresos Extraordinarios', 'egreso', false, '4.3'),
  ('4.3.9.1', 'Egresos Excepcionales', 'egreso', true, '4.3.9'),
  ('4.3.9.2', 'Gtos. Excepcionales - Multa', 'egreso', true, '4.3.9'),
  ('4.3.9.99', 'RECPAM', 'egreso', true, '4.3.9'),
  ('4.3.9.998', 'Cuenta Puente', 'egreso', true, '4.3.9'),
  ('4.3.9.999', 'Saldo inicial', 'egreso', true, '4.3.9')
on conflict (codigo) do update set
  nombre = excluded.nombre,
  tipo = excluded.tipo,
  imputable = excluded.imputable,
  codigo_padre = excluded.codigo_padre;

-- =====================================================================
-- 2. cajas: el usuario mandó su plan de cuentas real y de ahí sale la
-- lista real de cajas (dentro de "Caja y Bancos", 1.1.1), después de que
-- él mismo sacó las que no correspondían (tarjetas personales, cuentas
-- de otro socio, garantías de desarmaderos). "Financiera" y "Caja de
-- Seguridad" no entraban en el tipo original de 0041 (solo efectivo/
-- banco/billetera/fondo_fijo) — se agregan. También faltaba la moneda:
-- sin esto, sumar una caja en USD con una en ARS en "Disponible total"
-- daba un número sin sentido.
-- =====================================================================

alter table cajas drop constraint if exists cajas_tipo_check;
alter table cajas add constraint cajas_tipo_check
  check (tipo in ('efectivo', 'banco', 'billetera', 'fondo_fijo', 'financiera', 'custodia'));

alter table cajas add column if not exists moneda text not null default 'ARS'
  check (moneda in ('ARS', 'USD'));

alter table cajas drop constraint if exists cajas_nombre_key;
alter table cajas add constraint cajas_nombre_key unique (nombre);

-- Los 3 nombres genéricos que había sembrado la migración anterior no son
-- las cajas reales del usuario — se desactivan en vez de borrarlas (por
-- si algo ya las referenció) y quedan las 8 reales en su lugar.
update cajas set activa = false
  where nombre in ('Caja Central', 'Cuenta bancaria', 'Fondo fijo gestores');

insert into cajas (nombre, tipo, moneda) values
  ('Caja pesos', 'efectivo', 'ARS'),
  ('Caja en Financiera', 'financiera', 'ARS'),
  ('Caja en USD', 'efectivo', 'USD'),
  ('Caja de Seguridad en USD', 'custodia', 'USD'),
  ('Caja de Seguridad en $', 'custodia', 'ARS'),
  ('Fondo Fijos en pesos', 'fondo_fijo', 'ARS'),
  ('Banco Galicia CTa Cte', 'banco', 'ARS'),
  ('Caja Chica', 'efectivo', 'ARS')
on conflict (nombre) do nothing;

-- =====================================================================
-- 3. Mapeo por defecto de los conceptos de movimiento existentes a una
-- cuenta del plan real. "Otro" se deja sin mapear a propósito (no hay una
-- cuenta obviamente correcta) — el resto lo confirmó el usuario.
-- =====================================================================

update conceptos_movimiento set cuenta_contable_id =
  (select id from cuentas_contables where codigo = '4.2.6.3')
  where nombre = 'Pago a la compañía' and tipo = 'egreso';

update conceptos_movimiento set cuenta_contable_id =
  (select id from cuentas_contables where codigo = '4.1.2')
  where nombre = 'Cobro a la aseguradora' and tipo = 'ingreso';

update conceptos_movimiento set cuenta_contable_id =
  (select id from cuentas_contables where codigo = '4.1.2')
  where nombre = 'Cobro al desarmadero' and tipo = 'ingreso';

update conceptos_movimiento set cuenta_contable_id =
  (select id from cuentas_contables where codigo = '4.1.2.3')
  where nombre = 'Informe de Ingeniero' and tipo = 'ingreso';

update conceptos_movimiento set cuenta_contable_id =
  (select id from cuentas_contables where codigo = '4.2.6.7')
  where nombre = 'Honorarios por Gestoría' and tipo = 'egreso';

update conceptos_movimiento set cuenta_contable_id =
  (select id from cuentas_contables where codigo = '4.2.6.4')
  where nombre in ('Informe de dominio', 'Informe de multas', 'Informe de patentes', 'Informe de Ingeniero')
  and tipo = 'egreso';

update conceptos_movimiento set cuenta_contable_id =
  (select id from cuentas_contables where codigo = '4.2.6.5')
  where nombre = 'Correo / moto envío' and tipo = 'egreso';
