import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import tebsaLogo from '@/assets/tebsa-logo.png';

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <img src={tebsaLogo} alt="TEBSA" className="w-10 h-10 object-contain" />
            <h1 className="text-2xl font-bold text-primary">TEBSA</h1>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Aviso de Privacidad</CardTitle>
            <p className="text-sm text-muted-foreground">Última actualización: Enero 2026</p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none space-y-6">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">1. Identidad del Responsable</h2>
              <p className="text-muted-foreground leading-relaxed">
                TEBSA (en adelante "la Empresa") es responsable del tratamiento de los datos personales que nos proporcione, 
                los cuales serán protegidos conforme a lo dispuesto por la Ley Federal de Protección de Datos Personales 
                en Posesión de los Particulares y demás normatividad aplicable.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">2. Datos Personales Recabados</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                Para las finalidades señaladas en el presente aviso de privacidad, podemos recabar sus datos personales 
                de distintas formas: cuando usted nos los proporciona directamente, cuando visita nuestro sitio web o 
                utiliza nuestros servicios en línea. Los datos personales que recabamos incluyen:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Nombre completo</li>
                <li>Correo electrónico</li>
                <li>Número de teléfono</li>
                <li>Información de ubicación (para servicios de rastreo)</li>
                <li>Datos de acceso a la plataforma (usuario y contraseña cifrada)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">3. Finalidades del Tratamiento</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                Los datos personales que recabamos serán utilizados para las siguientes finalidades:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Prestación de servicios de gestión y rastreo de transporte</li>
                <li>Administración y operación de su cuenta de usuario</li>
                <li>Comunicación relacionada con nuestros servicios</li>
                <li>Atención a solicitudes, quejas y sugerencias</li>
                <li>Cumplimiento de obligaciones legales</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">4. Transferencia de Datos</h2>
              <p className="text-muted-foreground leading-relaxed">
                Sus datos personales podrán ser transferidos y tratados dentro y fuera del país, únicamente a empresas 
                relacionadas con la prestación de los servicios contratados, así como a autoridades competentes cuando 
                exista una obligación legal de hacerlo. En todos los casos, nos comprometemos a que los terceros que 
                reciban sus datos se obliguen a protegerlos conforme a la legislación aplicable.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">5. Derechos ARCO</h2>
              <p className="text-muted-foreground leading-relaxed">
                Usted tiene derecho a conocer qué datos personales tenemos de usted, para qué los utilizamos y las 
                condiciones del uso que les damos (Acceso). Asimismo, es su derecho solicitar la corrección de su 
                información personal en caso de que esté desactualizada, sea inexacta o incompleta (Rectificación); 
                que la eliminemos de nuestros registros o bases de datos cuando considere que la misma no está siendo 
                utilizada conforme a los principios, deberes y obligaciones previstas en la normativa (Cancelación); 
                así como oponerse al uso de sus datos personales para fines específicos (Oposición). Estos derechos 
                se conocen como derechos ARCO.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">6. Uso de Cookies y Tecnologías</h2>
              <p className="text-muted-foreground leading-relaxed">
                Le informamos que en nuestra plataforma utilizamos cookies y otras tecnologías de seguimiento para 
                mejorar su experiencia de usuario, así como para analizar el uso del sitio. Estas tecnologías nos 
                permiten recordar sus preferencias y brindarle un servicio más personalizado.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">7. Modificaciones al Aviso de Privacidad</h2>
              <p className="text-muted-foreground leading-relaxed">
                Nos reservamos el derecho de efectuar en cualquier momento modificaciones o actualizaciones al 
                presente aviso de privacidad, para la atención de novedades legislativas, políticas internas o 
                nuevos requerimientos para la prestación de nuestros servicios. Estas modificaciones estarán 
                disponibles al público a través de nuestra plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">8. Contacto</h2>
              <p className="text-muted-foreground leading-relaxed">
                Si tiene alguna duda sobre este aviso de privacidad o sobre el tratamiento de sus datos personales, 
                puede contactarnos a través de los canales oficiales de TEBSA.
              </p>
            </section>

            <div className="pt-6 border-t border-border">
              <p className="text-sm text-muted-foreground text-center">
                Al utilizar nuestros servicios, usted acepta los términos de este Aviso de Privacidad.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Privacy;
