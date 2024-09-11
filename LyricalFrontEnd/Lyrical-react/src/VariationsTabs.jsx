import React, { useState } from 'react';

function VariationsTabs({ variations, onSelectVariation }) {
    const [selectedVariation, setSelectedVariation] = useState(null);

    const handleSelectVariation = (variationIndex) => {
        setSelectedVariation(variationIndex);
        onSelectVariation(variationIndex);
    };

    return (
        <div>
            <h2>Variations</h2>
            {variations.map((variation, index) => (
                <button key={index} onClick={() => handleSelectVariation(index)}>
                    Variation {index + 1}
                </button>
            ))}
        </div>
    );
}

export default VariationsTabs;
