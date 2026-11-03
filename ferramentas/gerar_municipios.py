"""Gera dados/municipios.js a partir dos CSVs de github.com/kelvins/municipios-brasileiros.

Uso: python ferramentas/gerar_municipios.py municipios.csv estados.csv dados/municipios.js
"""
import csv
import json
import sys


def main(caminho_municipios, caminho_estados, caminho_saida):
    with open(caminho_estados, encoding="utf-8-sig", newline="") as arquivo:
        ufs = {linha["codigo_uf"]: linha["uf"] for linha in csv.DictReader(arquivo)}

    with open(caminho_municipios, encoding="utf-8-sig", newline="") as arquivo:
        municipios = [
            [linha["nome"], ufs[linha["codigo_uf"]], float(linha["latitude"]), float(linha["longitude"])]
            for linha in csv.DictReader(arquivo)
        ]

    if len(municipios) < 5570 or len(ufs) != 27:
        sys.exit(f"Dados inesperados: {len(municipios)} municipios, {len(ufs)} UFs")
    fora_do_brasil = [m for m in municipios if not (-34 < m[2] < 6 and -74 < m[3] < -28)]
    if fora_do_brasil:
        sys.exit(f"Coordenadas fora do Brasil: {fora_do_brasil[:5]}")

    municipios.sort(key=lambda m: (m[0], m[1]))
    corpo = json.dumps(municipios, ensure_ascii=False, separators=(",", ":"))
    with open(caminho_saida, "w", encoding="utf-8", newline="\n") as arquivo:
        arquivo.write("// Gerado por ferramentas/gerar_municipios.py: [nome, uf, latitude, longitude]\n")
        arquivo.write(f"const MUNICIPIOS = {corpo};\n")


if __name__ == "__main__":
    main(*sys.argv[1:])
