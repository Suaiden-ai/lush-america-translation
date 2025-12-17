# Guia de Imagens para Landing Page do Mentorship

## Imagens Atualmente Utilizadas

### 1. Logo da Empresa
- **Arquivo**: `/public/logo_tfoe.png`
- **Uso**: Exibida na seção hero da landing page
- **Dimensões recomendadas**: 200x80px (altura de 16 no Tailwind)

### 2. Imagens do Unsplash (Temporárias)
As seguintes imagens estão sendo carregadas do Unsplash e podem ser substituídas por imagens locais:

#### Seção "About Us"
- **URL**: `https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&h=400&fit=crop`
- **Descrição**: Estudantes estudando
- **Uso**: Seção "Sobre Nós"

#### Depoimentos dos Estudantes
- **Maria Silva**: `https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face`
- **Carlos Rodriguez**: `https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face`
- **Ana Costa**: `https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face`

## Como Adicionar Imagens Personalizadas

### 1. Substituir Imagens do Unsplash

Para substituir as imagens do Unsplash por imagens locais:

1. **Adicione as imagens na pasta `/public/`**:
   ```
   /public/
   ├── logo_tfoe.png
   ├── about-students.jpg
   ├── testimonial-maria.jpg
   ├── testimonial-carlos.jpg
   ├── testimonial-ana.jpg
   └── hero-background.jpg
   ```

2. **Atualize as URLs no código**:
   ```tsx
   // Em src/pages/Home.tsx, substitua as URLs do Unsplash:
   
   // Seção About Us
   <img 
     src="/about-students.jpg" 
     alt="Students studying" 
     className="rounded-lg shadow-lg w-full"
   />
   
   // Depoimentos
   const testimonials = [
     {
       name: "Maria Silva",
       image: "/testimonial-maria.jpg",
       // ...
     },
     {
       name: "Carlos Rodriguez", 
       image: "/testimonial-carlos.jpg",
       // ...
     },
     {
       name: "Ana Costa",
       image: "/testimonial-ana.jpg", 
       // ...
     }
   ];
   ```

### 2. Dimensões Recomendadas

- **Logo**: 200x80px
- **Imagem About Us**: 600x400px
- **Fotos de Depoimentos**: 150x150px (quadradas)
- **Imagem de Fundo Hero**: 1920x1080px

### 3. Otimização de Imagens

Para melhor performance:

1. **Comprima as imagens** usando ferramentas como:
   - TinyPNG (https://tinypng.com/)
   - ImageOptim (Mac)
   - FileOptimizer (Windows)

2. **Use formatos modernos**:
   - WebP para melhor compressão
   - JPG para fotografias
   - PNG para imagens com transparência

3. **Considere múltiplas resoluções** para dispositivos diferentes

### 4. Imagens Adicionais Recomendadas

Para melhorar ainda mais a landing page, considere adicionar:

#### Seção de Processos
- Imagens ilustrativas para cada etapa do processo
- Ícones personalizados para cada tipo de perfil (Initial, COS, Transfer)

#### Seção de Estatísticas
- Gráficos ou infográficos visuais
- Imagens de escolas parceiras

#### Seção de Contato
- Foto da equipe
- Imagem do escritório

### 5. Implementação de Imagens Responsivas

Para imagens que se adaptam a diferentes tamanhos de tela:

```tsx
<img 
  src="/about-students.jpg"
  srcSet="/about-students-small.jpg 300w,
          /about-students-medium.jpg 600w,
          /about-students-large.jpg 900w"
  sizes="(max-width: 768px) 100vw,
         (max-width: 1200px) 50vw,
         33vw"
  alt="Students studying" 
  className="rounded-lg shadow-lg w-full"
/>
```

### 6. Lazy Loading

Para melhorar a performance, adicione lazy loading:

```tsx
<img 
  src="/about-students.jpg" 
  alt="Students studying" 
  className="rounded-lg shadow-lg w-full"
  loading="lazy"
/>
```

## Próximos Passos

1. **Colete as imagens** que deseja usar
2. **Otimize-as** para web
3. **Adicione-as** na pasta `/public/`
4. **Atualize as referências** no código
5. **Teste** em diferentes dispositivos

## Notas Importantes

- Mantenha as imagens com tamanho total menor que 2MB
- Use nomes descritivos para os arquivos
- Considere a acessibilidade (alt text descritivo)
- Teste a performance após adicionar as imagens 