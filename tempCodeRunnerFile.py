# linkedin_post_generator.py
import os
import openai
import webbrowser
from dotenv import load_dotenv
from datetime import datetime
import tkinter as tk
from tkinter import simpledialog, messagebox, scrolledtext, StringVar

# Interface para pegar chave manualmente se não houver .env
load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")

if not api_key:
    root = tk.Tk()
    root.withdraw()
    api_key = simpledialog.askstring("Chave da API", "OPENAI_API_KEY não encontrada. Cole sua chave manualmente:")
    if not api_key:
        messagebox.showerror("Erro", "API Key não fornecida. Encerrando o programa.")
        exit(1)

openai_client = openai.OpenAI(api_key=api_key)

def gerar_post_linkedin(tema: str, tom: str = "profissional") -> str:
    prompt = (
        f"Crie uma publicação para o LinkedIn em português sobre o seguinte tema: '{tema}'. "
        f"Use um tom {tom}, com no máximo 150 palavras. Não use hashtags."
    )

    try:
        resposta = openai_client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "Você é um especialista em marketing pessoal para LinkedIn."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=300
        )
        return resposta.choices[0].message.content.strip()
    except Exception as e:
        return f"Erro ao gerar conteúdo: {str(e)}"

def salvar_post(texto: str, formatos=("txt", "md")):
    pasta = "posts"
    os.makedirs(pasta, exist_ok=True)
    data = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    arquivos_salvos = []

    for ext in formatos:
        nome_arquivo = os.path.join(pasta, f"linkedin_post_{data}.{ext}")
        with open(nome_arquivo, "w", encoding="utf-8") as f:
            f.write(texto)
        arquivos_salvos.append(nome_arquivo)

    messagebox.showinfo("Salvo", f"Texto salvo como: {', '.join(arquivos_salvos)}")

    for arquivo in arquivos_salvos:
        webbrowser.open(f"file://{os.path.abspath(arquivo)}")

def iniciar_interface():
    root = tk.Tk()
    root.withdraw()

    tema = simpledialog.askstring("Tema", "Digite o tema da publicação:")
    if not tema:
        return
    tom = simpledialog.askstring("Tom", "Qual o tom desejado (profissional, inspirador, educativo, etc)?") or "profissional"

    resultado = gerar_post_linkedin(tema, tom)

    editor = tk.Toplevel()
    editor.title("Editar publicação")

    texto_area = scrolledtext.ScrolledText(editor, wrap=tk.WORD, width=80, height=20)
    texto_area.pack(padx=10, pady=(10, 0))
    texto_area.insert(tk.END, resultado)

    contador_var = StringVar()
    contador_label = tk.Label(editor, textvariable=contador_var)
    contador_label.pack(pady=(5, 0))

    def atualizar_contador(event=None):
        texto = texto_area.get("1.0", tk.END).strip()
        palavras = len(texto.split())
        caracteres = len(texto)
        contador_var.set(f"Palavras: {palavras} | Caracteres: {caracteres}")

    texto_area.bind("<KeyRelease>", atualizar_contador)
    atualizar_contador()

    def salvar():
        texto_final = texto_area.get("1.0", tk.END).strip()
        salvar_post(texto_final, formatos=("txt", "md"))
        editor.destroy()

    botao_salvar = tk.Button(editor, text="Salvar como .txt e .md", command=salvar)
    botao_salvar.pack(pady=10)

    editor.mainloop()

if __name__ == "__main__":
    iniciar_interface()