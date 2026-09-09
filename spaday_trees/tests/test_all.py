import ast
from pathlib import Path

from spaday import generate
from spaday.bootstrap import bootstrap

from spaday_trees import TOKENS, Tree, package


def test_tree_serializes_the_wrapper_properties():
    node = Tree(paths=["src/index.ts"], selected_paths=["src/index.ts"], search="index").to_node()
    assert node["tag"] == "spaday-tree"
    assert node["props"]["paths"]["List"][0] == {"Str": "src/index.ts"}
    assert node["props"]["selected_paths"]["List"][0] == {"Str": "src/index.ts"}


def test_tree_serializes_decorations_and_expansion():
    node = Tree(
        paths=["src/index.ts"],
        expanded_paths=["src/"],
        decorations={"src/index.ts": {"tone": "danger", "badge": "3"}},
        git_status=[{"path": "src/index.ts", "status": "modified"}],
    ).to_node()
    assert node["props"]["expanded_paths"]["List"][0] == {"Str": "src/"}
    decoration = node["props"]["decorations"]["Map"]["src/index.ts"]["Map"]
    assert decoration == {"tone": {"Str": "danger"}, "badge": {"Str": "3"}}
    assert node["props"]["git_status"]["List"][0]["Map"]["status"] == {"Str": "modified"}


def test_package_drives_bootstrap_asset_url():
    assert package.name == "trees"
    assert [(schema.tag, schema.class_name) for schema in package.catalog] == [("spaday-tree", "SpadayTree")]
    html = bootstrap(packages=[package])
    assert 'src="/components/trees/cdn/index.js"' in html
    assert 'href="/components/trees/css/index.css"' in html


def test_generated_component_is_current():
    root = Path(__file__).parent.parent
    fresh = generate(str(root / "components.cem.json"))
    assert ast.dump(ast.parse(fresh)) == ast.dump(ast.parse((root / "components.py").read_text(encoding="utf-8")))


def test_tokens_documents_exactly_what_the_stylesheet_reads():
    """TOKENS is what a Python author discovers; the stylesheet is what renders."""
    import re

    css = re.sub(r"\s+", "", (Path(__file__).parents[2] / "js" / "src" / "css" / "index.css").read_text())
    read = set(re.findall(r"var\((--spa-trees-[a-z-]+)[,)]", css))
    assert read == {prop for prop, _ in TOKENS.values()}
    # a public token must never be defined here, or a token set on an ancestor (an App-level theme)
    # would lose to the package default
    assert not re.findall(r"(?<![-\w])(--spa-trees-[a-z-]+):", css)


def test_tones_chain_through_the_legacy_spelling_to_the_shell():
    import re

    css = re.sub(r"\s+", "", (Path(__file__).parents[2] / "js" / "src" / "css" / "index.css").read_text())
    for tone, shell in (("info", "info"), ("success", "success"), ("warning", "warning"), ("danger", "danger"), ("muted", "muted")):
        definition = re.search(rf"--_spa-trees-tone-{tone}:([^;]+);", css).group(1)
        assert f"var(--trees-tone-{tone}," in definition  # older spelling still works
        assert f"var(--spa-{shell}," in definition  # and the shell tone is the default
