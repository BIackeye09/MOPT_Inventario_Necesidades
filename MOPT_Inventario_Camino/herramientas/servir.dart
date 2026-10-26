// Inicia la PWA del inventario con Dart, igual que el Reporte Diario MOPT.
// Usa únicamente dart:io: no necesita Node.js ni descargar paquetes.
// Desde la carpeta del proyecto: dart herramientas/servir.dart
import 'dart:io';

const _tipos = <String, String>{
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.pdf': 'application/pdf',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

Future<void> main(List<String> argumentos) async {
  // El inventario usa 8081 para convivir con Reporte Diario en 8080.
  var puerto = 8081;
  var abrirNavegador = true;

  // Las opciones son útiles para pruebas; el uso diario no requiere argumentos.
  for (final argumento in argumentos) {
    if (argumento == '--no-open') {
      abrirNavegador = false;
    } else if (argumento.startsWith('--port=')) {
      puerto = int.tryParse(argumento.substring(7)) ?? 0;
    } else {
      stderr.writeln('Opción desconocida: $argumento');
      stderr.writeln(
        'Uso: dart herramientas/servir.dart [--port=8081] [--no-open]',
      );
      exitCode = 1;
      return;
    }
  }
  if (puerto < 1 || puerto > 65535) {
    stderr.writeln('El puerto debe ser un número entre 1 y 65535.');
    exitCode = 1;
    return;
  }

  // La ubicación depende del archivo Dart, no de la carpeta de la terminal.
  // Así también funciona al ejecutar servir.dart directamente desde VS Code.
  final carpeta = Directory.fromUri(Platform.script.resolve('../dist/'));
  if (!File.fromUri(carpeta.uri.resolve('index.html')).existsSync()) {
    stderr.writeln('No se encontró dist/index.html. Extraé TODO el ZIP.');
    exitCode = 1;
    return;
  }
  final raiz = Directory(carpeta.resolveSymbolicLinksSync());

  late final HttpServer servidor;
  try {
    // Solo atiende esta computadora; localhost permite usar la PWA instalada.
    servidor = await HttpServer.bind(InternetAddress.loopbackIPv4, puerto);
  } on SocketException catch (error) {
    stderr.writeln('No se pudo iniciar el inventario en el puerto $puerto.');
    stderr.writeln(
      'Cerrá otro servidor que esté usando este mismo puerto',
    );
    stderr.writeln(
      'con Ctrl+C o con el botón de detener de VS Code y probá de nuevo.',
    );
    stderr.writeln('También podés elegir otro con --port=8082.');
    stderr.writeln('Detalle: ${error.message}');
    exitCode = 1;
    return;
  }

  final direccion = 'http://localhost:$puerto';
  stdout.writeln('MOPT · Inventario de Necesidades del Camino');
  stdout.writeln('Aplicación disponible en $direccion');
  stdout.writeln('Dejá la terminal abierta. Ctrl+C para detener.');
  if (abrirNavegador) await _abrir(direccion);

  await for (final solicitud in servidor) {
    await _responder(solicitud, raiz);
  }
}

Future<void> _responder(HttpRequest solicitud, Directory raiz) async {
  final respuesta = solicitud.response;
  try {
    // El servidor solo lee archivos de dist: nunca publica los originales.
    if (solicitud.method != 'GET' && solicitud.method != 'HEAD') {
      respuesta.headers.set(HttpHeaders.allowHeader, 'GET, HEAD');
      await _error(
        respuesta,
        HttpStatus.methodNotAllowed,
        'Método no permitido',
      );
      return;
    }
    final partes = solicitud.uri.pathSegments
        .where((p) => p.isNotEmpty)
        .toList();
    if (partes.any(
      (p) =>
          p == '.' ||
          p == '..' ||
          p.contains('/') ||
          p.contains('\\') ||
          p.contains('\u0000'),
    )) {
      await _error(respuesta, HttpStatus.forbidden, 'Acceso no permitido');
      return;
    }
    if (partes.isEmpty) partes.add('index.html');
    final archivo = File.fromUri(
      raiz.uri.resolveUri(Uri(pathSegments: partes)),
    );
    if (!await archivo.exists()) {
      await _error(respuesta, HttpStatus.notFound, 'Archivo no encontrado');
      return;
    }

    // También evita que un enlace simbólico apunte fuera de la carpeta pública.
    final rutaReal = await archivo.resolveSymbolicLinks();
    if (!rutaReal.startsWith('${raiz.path}${Platform.pathSeparator}')) {
      await _error(respuesta, HttpStatus.forbidden, 'Acceso no permitido');
      return;
    }
    final punto = rutaReal.lastIndexOf('.');
    final extension = punto < 0 ? '' : rutaReal.substring(punto).toLowerCase();
    respuesta.headers.set(
      HttpHeaders.contentTypeHeader,
      _tipos[extension] ?? 'application/octet-stream',
    );
    // Permite comprobar los recursos nuevos y las actualizaciones del service worker.
    respuesta.headers.set(HttpHeaders.cacheControlHeader, 'no-cache');
    respuesta.headers.set('X-Content-Type-Options', 'nosniff');
    respuesta.contentLength = await archivo.length();
    if (solicitud.method == 'GET')
      await respuesta.addStream(archivo.openRead());
    await respuesta.close();
  } on FileSystemException {
    await _error(respuesta, HttpStatus.notFound, 'Archivo no encontrado');
  } on FormatException {
    await _error(respuesta, HttpStatus.badRequest, 'Dirección no válida');
  } on HttpException {
    // Si el navegador cancela una petición, el servidor continúa atendiendo.
  } on SocketException {
    // Una pestaña cerrada tampoco detiene el programa.
  }
}

Future<void> _error(HttpResponse respuesta, int codigo, String mensaje) async {
  respuesta.statusCode = codigo;
  respuesta.headers.contentType = ContentType.text;
  respuesta.write(mensaje);
  await respuesta.close();
}

Future<void> _abrir(String direccion) async {
  try {
    // Windows usa el navegador predeterminado sin necesitar extensiones web.
    final programa = Platform.isWindows
        ? 'rundll32.exe'
        : Platform.isMacOS
        ? 'open'
        : 'xdg-open';
    final opciones = Platform.isWindows
        ? <String>['url.dll,FileProtocolHandler', direccion]
        : <String>[direccion];
    await Process.start(programa, opciones, mode: ProcessStartMode.detached);
  } on ProcessException {
    stdout.writeln('Abrí tu navegador e ingresá $direccion');
  }
}
