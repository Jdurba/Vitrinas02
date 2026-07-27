// ==========================================
// CONFIGURACIÓN GLOBAL
// ==========================================
const CONFIG = {
    precios: {
        Tirador_126x35: 7.62,
        Tirador_37x16: 5.25,
        bisagra_extra: 5.00
    },
    bisagras_rangos: [
        { hasta: 900,  num: 2 },
        { hasta: 1600, num: 3 },
        { hasta: 2000, num: 4 },
        { hasta: 2500, num: 5 },
        { hasta: 2800, num: 6 }
    ],
    bisagras_B1_defecto: 100,
    bisagras_B2_defecto: 100,
    bisagras_B_minimo:    70,
    bisagras_C_minimo:    80,
    bisagras_max_global:   6,
    modelos: {
        // sinTirador: true → el perfil no admite tirador mecanizado (independiente de bisagras_fijas)
        // codeTipo → 2 dígitos para composición del código Odoo: VV.{codeTipo}{codeVidrio}.{codAcabado}
        '7991':   { nombre: '20x45 P8',      maxAltura: 2400, maxAncho: 600, Minimo: 150, imagen: '7991',   acabados: ['PM','P','B','BM03','NM','RB','NG'], DescV_Alt: 5, DescV_Anc: 5, codeTipo: '01', denominacion: 'VITRINA 20X45 P8' },
        '7994':   { nombre: '20x45 P4',      maxAltura: 2400, maxAncho: 600, Minimo: 150, imagen: '7994',   acabados: ['PM','P','B','NM'], DescV_Alt: 5, DescV_Anc: 5, codeTipo: '02', denominacion: 'VITRINA 20X45 P4'  },
        '7995':   { nombre: '35x45 P8',      maxAltura: 2800, maxAncho: 600, Minimo: 150, imagen: '7995',   acabados: ['PM','P','B','BM03','NM'], DescV_Alt: 5, DescV_Anc: 5, sinTirador: true, codeTipo: '03', denominacion: 'VITRINA 35X45 P8'  },
        '7990':   { nombre: '20x45 P20',     maxAltura: 2400, maxAncho: 600, Minimo: 150, imagen: '7990',   acabados: ['PM','P','B','NM'], DescV_Alt: 5, DescV_Anc: 5, codeTipo: '04', denominacion: 'VITRINA 20X45 P20'  },
        '7998':   { nombre: '20x45 P45',     maxAltura: 2400, maxAncho: 600, Minimo: 150, imagen: '7998',   acabados: ['PM','P','B','NM','RB'], DescV_Alt: 40, DescV_Anc: 40, codeTipo: '05', denominacion: 'VITRINA 20X45 P45'  },
        '7993':   { nombre: '19x21',         maxAltura: 2400, maxAncho: 600, Minimo: 150, imagen: '7993',   acabados: ['PM','P','B','NM','RB','NG'], DescV_Alt: 5, DescV_Anc: 5, codeTipo: '06', denominacion: 'VITRINA 19X21'  },
        '7996':   { nombre: '20x18 P8',      maxAltura: 2400, maxAncho: 600, Minimo: 150, imagen: '7996',   acabados: ['PM','P','B','NM','RB','NG'], DescV_Alt: 5, DescV_Anc: 5, codeTipo: '07', denominacion: 'VITRINA 20X18 P8'  },
        '7999':   { nombre: '16x60 S/P',     maxAltura: 2400, maxAncho: 600, Minimo: 150, imagen: '7999',   acabados: ['PM','P','B','NM'], DescV_Alt: 2, DescV_Anc: 2, sinTirador: true, codeTipo: '08', denominacion: 'VITRINA 16X60 S/P'  },
        '79916':  { nombre: '20x56 C/P',     maxAltura: 2400, maxAncho: 600, Minimo: 150, imagen: '79916',  acabados: ['PM','P','B','NM'], DescV_Alt: 3, DescV_Anc: 3, codeTipo: '09', denominacion: 'VITRINA 20X56 C/P'  },
        'BT100':  { nombre: 'Perfil BT100',  maxAltura: 2600, maxAncho: 600, Minimo: 150, imagen: 'BT100',  acabados: ['PM','P','B','NM'], DescV_Alt: 15, DescV_Anc: 15, sinTirador: true, codeTipo: '10', denominacion: 'VITRINA PERFIL BT100'  },
        'BT110':  { nombre: 'Perfil BT110',  maxAltura: 2700, maxAncho: 600, Minimo: 150, imagen: 'BT110',  acabados: ['PM','P','B','NM'], DescV_Alt: 50, DescV_Anc: 50, codeTipo: '11', denominacion: 'VITRINA PERFIL BT110'  },
        'KABI':   { nombre: 'Perfiles KABI', maxAltura: 2400, maxAncho: 900, Minimo: 150, imagen: 'Kabi',   acabados: ['BM03','NM','BR'], bisagras_fijas: 2, DescV_Alt: 20, DescV_Anc: 20, sinTirador: true, codeTipo: '21', denominacion: 'VITRINA PERFILES KABI'  },
        'HAVA':   { nombre: 'Perfiles HAVA', maxAltura: 2400, maxAncho: 900, Minimo: 150, imagen: 'Hava',   acabados: ['BM03','NM','BR'], bisagras_fijas: 2, DescV_Alt: 3, DescV_Anc: 3, sinTirador: true, codeTipo: '22', denominacion: 'VITRINA PERFILES HAVA'  },
        'HAVASP': { nombre: 'HAVA S/P',      maxAltura: 2400, maxAncho: 900, Minimo: 150, imagen: 'HavaSP', acabados: ['BM03','NM','BR'], bisagras_fijas: 2, DescV_Alt: 3, DescV_Anc: 3, sinTirador: true, codeTipo: '23', denominacion: 'VITRINA HAVA S/P'  }
    },
    acabados: {
        // grupoPrecio → columna Acabado del CSV de tarifas
        // codigo/denominacion → composición de código y denominación Odoo
        'PM':   { nombre: 'Plata Mate (A.PM)',          grupoPrecio: 'ANODIZADO', codigo: 'A.PM',   denominacion: 'ANOD PLATA MATE' },
        'P':    { nombre: 'Plata Brillo (A.P)',         grupoPrecio: 'ANODIZADO', codigo: 'A.P',    denominacion: 'ANOD PLATA BRILLO' },
        'B':    { nombre: 'Lacado Blanco Brillo (L.B)', grupoPrecio: 'LACADO',    codigo: 'L.B',    denominacion: 'LAC BLANCO BRILLO' },
        'BM03': { nombre: 'Blanco Mate 9003 (L.BM03)',  grupoPrecio: 'LACADO',    codigo: 'L.BM03', denominacion: 'LAC BLANCO MATE 9003' },
        'NM':   { nombre: 'Lacado Negro Mate (L.NM)',   grupoPrecio: 'LACADO',    codigo: 'L.NM',   denominacion: 'LAC NEGRO MATE' },
        'BR':   { nombre: 'Bronce Cepillado (A.BR)',    grupoPrecio: 'ANODIZADO', codigo: 'A.BR',   denominacion: 'ANOD BRONCE CEPILLADO' },
        'RB':   { nombre: 'Chapa Roble (C.RB)',         grupoPrecio: 'RECHAPADO',     codigo: 'C.RB',   denominacion: 'CHAPA ROBLE' },
        'NG':   { nombre: 'Chapa Nogal (C.NG)',         grupoPrecio: 'RECHAPADO',     codigo: 'C.NG',   denominacion: 'CHAPA NOGAL' }
    },
    coloresVidrio: {
        // grupoPrecio → columna ColorVidrio del CSV de tarifas (CONSULTAR = sin precio, consultar siempre)
        // codeVidrio → 2 dígitos para composición del código Odoo ('00' = sin vidrio montado)
        'transparente': { nombre: 'Transparente', grupoPrecio: 'TRANSPARENTE', codeVidrio: '01', denominacion: 'VIDRIO TRANSPARENTE' },
        'mate':         { nombre: 'Mate',         grupoPrecio: 'MATE',         codeVidrio: '02', denominacion: 'VIDRIO MATE' },
        'bronce':       { nombre: 'Bronce',       grupoPrecio: 'COLORMIX01',    codeVidrio: '03', denominacion: 'VIDRIO BRONCE' },
        'gris':         { nombre: 'Gris',         grupoPrecio: 'COLORMIX01',    codeVidrio: '04', denominacion: 'VIDRIO GRIS' },
        'grisoscuro':   { nombre: 'Gris oscuro',  grupoPrecio: 'GRISOSCURO',   codeVidrio: '05', denominacion: 'VIDRIO GRIS OSCURO' },
        'especial':     { nombre: 'Especial',     grupoPrecio: 'CONSULTAR',    codeVidrio: '06', denominacion: 'VIDRIO ESPECIAL' }
    },
    tiradores: {
        '126x35': {
            nombre: 'Tirador 126x35',
            medidas: '126 × 35 mm',
            imagen: 'https://raw.githubusercontent.com/Jdurba/Vitrinas/main/Imagenes/126x35.jpg'
        },
        '37x16': {
            nombre: 'Tirador 37x16',
            medidas: '37 × 16 mm',
            imagen: 'https://raw.githubusercontent.com/Jdurba/Vitrinas/main/Imagenes/37x16.jpg'
        }
    }
};
