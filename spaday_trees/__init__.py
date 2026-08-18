from pathlib import Path

from spaday import ComponentPackage

from .components import SpadayTree

__version__ = "0.2.0"

package = ComponentPackage(
    name="trees",
    assets_dir=Path(__file__).parent / "extension",
    assets=(("js", "cdn/index.js"),),
    components=(SpadayTree,),
)

Tree = SpadayTree

__all__ = ["SpadayTree", "Tree", "package"]
